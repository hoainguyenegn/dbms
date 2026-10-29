import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mysqlPool } from '../config/database.js';
import { sendOtpEmail } from '../services/emailService.js';
import { saveOtp, verifyOtp, getVerifiedData, consumeVerifiedToken } from '../services/otpService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'eventbox_super_secret_jwt_key_2026_hk261';
const JWT_EXPIRES_IN = '24h';

/**
 * BƯỚC 1: Gửi mã OTP về email để bắt đầu đăng ký
 * POST /api/auth/register/send-otp
 * Body: { email, full_name }
 */
export async function sendRegisterOtp(request, response, next) {
  try {
    const { email, full_name } = request.body;

    if (!email || !email.trim()) {
      return response.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Vui lòng cung cấp địa chỉ email.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Kiểm tra định dạng email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return response.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Địa chỉ email không đúng định dạng.',
      });
    }

    // 2. Kiểm tra xem email đã được đăng ký tài khoản chưa (Email là định danh duy nhất!)
    const [existingUsers] = await mysqlPool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [trimmedEmail, trimmedEmail]
    );

    if (existingUsers.length > 0) {
      return response.status(409).json({
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'Địa chỉ email này đã được đăng ký tài khoản. Vui lòng đăng nhập.',
      });
    }

    // 3. Sinh mã OTP ngẫu nhiên gồm 6 chữ số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Lưu OTP (Redis TTL 300s hoặc Fallback RAM)
    await saveOtp(trimmedEmail, otp, full_name);

    // 5. Gửi email xác thực
    const emailResult = await sendOtpEmail({
      to: trimmedEmail,
      otp,
      fullName: full_name ? full_name.trim() : 'Bạn',
    });

    return response.json({
      message: 'Mã xác thực đã được gửi về email của bạn. Vui lòng kiểm tra hộp thư.',
      email: trimmedEmail,
      expires_in: 300,
      preview_url: emailResult.previewUrl,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * BƯỚC 2: Xác nhận mã OTP do người dùng nhập
 * POST /api/auth/register/verify-otp
 * Body: { email, otp }
 */
export async function verifyRegisterOtp(request, response, next) {
  try {
    const { email, otp } = request.body;

    if (!email || !otp) {
      return response.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Vui lòng cung cấp email và mã xác thực OTP.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const result = await verifyOtp(trimmedEmail, otp);

    if (!result.valid) {
      return response.status(400).json({
        error: result.error,
        message: result.message,
      });
    }

    return response.json({
      message: 'Xác thực OTP thành công! Vui lòng thiết lập mật khẩu đăng nhập.',
      email: trimmedEmail,
      full_name: result.fullName,
      verification_token: result.verificationToken,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * BƯỚC 3: Tạo mật khẩu đăng nhập và hoàn tất đăng ký tài khoản
 * POST /api/auth/register/complete
 * Body: { email, verification_token, password, full_name }
 */
export async function completeRegisterWithPassword(request, response, next) {
  try {
    const { email, verification_token, password, full_name } = request.body;

    if (!email || !verification_token || !password) {
      return response.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Vui lòng cung cấp đầy đủ thông tin: email, mã xác minh và mật khẩu.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Kiểm tra vé xác thực (Verification Token)
    const verifiedData = await getVerifiedData(verification_token);
    if (!verifiedData || verifiedData.email !== trimmedEmail) {
      return response.status(403).json({
        error: 'INVALID_VERIFICATION_TOKEN',
        message: 'Phiên xác thực email không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại từ đầu.',
      });
    }

    // 2. Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
      return response.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
      });
    }

    // 3. Kiểm tra trùng lặp email lần cuối trước khi ghi CSDL
    const [existing] = await mysqlPool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [trimmedEmail, trimmedEmail]
    );

    if (existing.length > 0) {
      return response.status(409).json({
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'Địa chỉ email này đã được đăng ký tài khoản.',
      });
    }

    // 4. Băm mật khẩu an toàn với Bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const finalFullName = (full_name || verifiedData.fullName || trimmedEmail.split('@')[0]).trim();

    // 5. Lưu vào MySQL: email đồng thời là tên đăng nhập duy nhất (username = email)
    const [insertResult] = await mysqlPool.execute(
      `INSERT INTO users (username, password_hash, full_name, email, role)
       VALUES (?, ?, ?, ?, 'USER')`,
      [trimmedEmail, passwordHash, finalFullName, trimmedEmail]
    );

    const newUserId = insertResult.insertId;

    // 6. Tiêu hủy vé xác minh để chống tái sử dụng
    await consumeVerifiedToken(verification_token);

    // 7. Cấp phát JWT Token
    const token = jwt.sign(
      {
        id: newUserId,
        username: trimmedEmail,
        email: trimmedEmail,
        role: 'USER',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return response.status(201).json({
      message: 'Đăng ký tài khoản thành công! Bạn đã được tự động đăng nhập.',
      token,
      user: {
        id: newUserId,
        username: trimmedEmail,
        email: trimmedEmail,
        full_name: finalFullName,
        role: 'USER',
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Đăng ký tài khoản trực tiếp (Duy trì tính tương thích ngược)
 * POST /api/auth/register
 */
export async function register(request, response, next) {
  try {
    const { username, password, full_name, email } = request.body;

    const userEmail = (email || username || '').trim().toLowerCase();

    if (!userEmail || !password || !full_name) {
      return response.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Vui lòng cung cấp email, họ tên và mật khẩu.',
      });
    }

    if (password.length < 6) {
      return response.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
      });
    }

    const [existingUsers] = await mysqlPool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [userEmail, userEmail]
    );

    if (existingUsers.length > 0) {
      return response.status(409).json({
        error: 'DUPLICATE_USER',
        message: 'Địa chỉ email này đã được đăng ký tài khoản.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [insertResult] = await mysqlPool.execute(
      `INSERT INTO users (username, password_hash, full_name, email, role)
       VALUES (?, ?, ?, ?, 'USER')`,
      [userEmail, passwordHash, full_name.trim(), userEmail]
    );

    const newUserId = insertResult.insertId;
    const token = jwt.sign(
      { id: newUserId, username: userEmail, email: userEmail, role: 'USER' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return response.status(201).json({
      message: 'Đăng ký tài khoản thành công.',
      token,
      user: {
        id: newUserId,
        username: userEmail,
        email: userEmail,
        full_name: full_name.trim(),
        role: 'USER',
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Đăng nhập hệ thống (Email là tên đăng nhập duy nhất)
 * POST /api/auth/login
 * Body: { email (hoặc username), password }
 */
export async function login(request, response, next) {
  try {
    const { email, username, password } = request.body;
    const identifier = (email || username || '').trim();

    if (!identifier || !password) {
      return response.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Vui lòng nhập email đăng nhập và mật khẩu.',
      });
    }

    // Tìm tài khoản theo email hoặc username
    const [rows] = await mysqlPool.execute(
      `SELECT id, username, password_hash, full_name, email, role
       FROM users
       WHERE email = ? OR username = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return response.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    const user = rows[0];

    // Đối chiếu mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return response.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return response.json({
      message: 'Đăng nhập thành công.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Lấy thông tin tài khoản đang đăng nhập từ JWT Token
 * GET /api/auth/me
 */
export async function getMe(request, response, next) {
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT id, username, full_name, email, role, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [request.user.id]
    );

    if (rows.length === 0) {
      return response.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Tài khoản không tồn tại trên hệ thống.',
      });
    }

    return response.json({
      user: rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Đăng xuất tài khoản
 * POST /api/auth/logout
 */
export function logout(_request, response) {
  return response.json({
    message: 'Đăng xuất thành công.',
  });
}
