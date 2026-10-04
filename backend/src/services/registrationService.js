import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

export class RegistrationError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validateRegistrationInput(input) {
  const username = typeof input?.username === 'string' ? input.username.trim() : '';
  const fullName = typeof input?.full_name === 'string' ? input.full_name.trim() : '';
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input?.password === 'string' ? input.password : '';

  if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
    throw new RegistrationError(400, 'INVALID_USERNAME', 'Tên đăng nhập cần có 3–50 ký tự chữ, số hoặc gạch dưới.');
  }
  if (!fullName || fullName.length > 100) {
    throw new RegistrationError(400, 'INVALID_FULL_NAME', 'Họ tên không được để trống và tối đa 100 ký tự.');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RegistrationError(400, 'INVALID_EMAIL', 'Địa chỉ email không hợp lệ.');
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new RegistrationError(400, 'INVALID_PASSWORD', 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte.');
  }
  return { username, fullName, email, password };
}

export function hashRegistrationCode(email, code, secret) {
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}

function matchesCode(email, code, expectedHash, secret) {
  const suppliedHash = Buffer.from(hashRegistrationCode(email, code, secret), 'hex');
  const storedHash = Buffer.from(expectedHash, 'hex');
  return suppliedHash.length === storedHash.length && timingSafeEqual(suppliedHash, storedHash);
}

export async function requestRegistration(pool, input, sendCode) {
  const registration = validateRegistrationInput(input);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new RegistrationError(503, 'OTP_UNAVAILABLE', 'Dịch vụ xác minh chưa được cấu hình.');

  const [existingUsers] = await pool.execute(
    'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
    [registration.username, registration.email],
  );
  if (existingUsers.length) {
    throw new RegistrationError(409, 'ACCOUNT_EXISTS', 'Tên đăng nhập hoặc email đã được sử dụng.');
  }

  const passwordHash = await bcrypt.hash(registration.password, 10);
  const connection = await pool.getConnection();
  let transactionOpen = false;
  const otpId = randomUUID();
  const code = String(randomInt(100000, 1000000));

  try {
    await connection.beginTransaction();
    transactionOpen = true;
    await connection.execute(
      'DELETE FROM registration_otps WHERE expires_at <= UTC_TIMESTAMP(3)',
    );
    const [pendingRows] = await connection.execute(
      `SELECT id, email, username,
              sent_at > UTC_TIMESTAMP(3) - INTERVAL 60 SECOND AS within_cooldown
         FROM registration_otps
        WHERE email = ? OR username = ?
        FOR UPDATE`,
      [registration.email, registration.username],
    );
    const pending = pendingRows[0];
    if (pending && (pending.email !== registration.email || pending.username !== registration.username)) {
      throw new RegistrationError(409, 'REGISTRATION_PENDING', 'Email hoặc tên đăng nhập đang được dùng cho một đăng ký chưa xác minh.');
    }
    if (pending?.within_cooldown) {
      throw new RegistrationError(429, 'OTP_COOLDOWN', 'Vui lòng chờ 60 giây trước khi gửi mã mới.');
    }

    await connection.execute(
      `INSERT INTO registration_otps
         (id, email, username, password_hash, full_name, otp_hash, attempts, expires_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE), UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         id = VALUES(id), password_hash = VALUES(password_hash), full_name = VALUES(full_name),
         otp_hash = VALUES(otp_hash), attempts = 0,
         expires_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE), sent_at = UTC_TIMESTAMP(3)`,
      [
        otpId,
        registration.email,
        registration.username,
        passwordHash,
        registration.fullName,
        hashRegistrationCode(registration.email, code, secret),
      ],
    );
    await connection.commit();
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new RegistrationError(409, 'REGISTRATION_PENDING', 'Email hoặc tên đăng nhập đang được dùng cho một đăng ký chưa xác minh.');
    }
    throw error;
  } finally {
    connection.release();
  }

  try {
    await sendCode(registration.email, code);
  } catch {
    await pool.execute('DELETE FROM registration_otps WHERE id = ?', [otpId]);
    throw new RegistrationError(503, 'EMAIL_DELIVERY_FAILED', 'Chưa gửi được email xác minh. Vui lòng thử lại sau.');
  }

  return { email: registration.email, expiresInSeconds: 600 };
}

export async function verifyRegistration(pool, input) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const code = typeof input?.code === 'string' ? input.code.trim() : '';
  const secret = process.env.JWT_SECRET;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
    throw new RegistrationError(400, 'INVALID_OTP_INPUT', 'Email hoặc mã xác minh không hợp lệ.');
  }
  if (!secret) throw new RegistrationError(503, 'OTP_UNAVAILABLE', 'Dịch vụ xác minh chưa được cấu hình.');

  const connection = await pool.getConnection();
  let transactionOpen = false;
  let user;

  try {
    await connection.beginTransaction();
    transactionOpen = true;
    const [rows] = await connection.execute(
      `SELECT id, email, username, password_hash, full_name, otp_hash, attempts,
              expires_at > UTC_TIMESTAMP(3) AS is_active
         FROM registration_otps WHERE email = ? FOR UPDATE`,
      [email],
    );
    const pending = rows[0];
    if (!pending) throw new RegistrationError(400, 'OTP_NOT_FOUND', 'Không tìm thấy yêu cầu xác minh đang chờ.');
    if (!pending.is_active) {
      await connection.execute('DELETE FROM registration_otps WHERE id = ?', [pending.id]);
      await connection.commit();
      transactionOpen = false;
      throw new RegistrationError(410, 'OTP_EXPIRED', 'Mã xác minh đã hết hạn. Hãy đăng ký lại để nhận mã mới.');
    }
    if (pending.attempts >= 5) {
      await connection.execute('DELETE FROM registration_otps WHERE id = ?', [pending.id]);
      await connection.commit();
      transactionOpen = false;
      throw new RegistrationError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Bạn đã nhập sai quá số lần cho phép. Hãy đăng ký lại.');
    }
    if (!matchesCode(email, code, pending.otp_hash, secret)) {
      await connection.execute(
        'UPDATE registration_otps SET attempts = attempts + 1 WHERE id = ?',
        [pending.id],
      );
      await connection.commit();
      transactionOpen = false;
      throw new RegistrationError(400, 'OTP_INVALID', 'Mã xác minh không đúng.');
    }

    const [result] = await connection.execute(
      `INSERT INTO users (username, password_hash, full_name, email, role)
       VALUES (?, ?, ?, ?, 'USER')`,
      [pending.username, pending.password_hash, pending.full_name, pending.email],
    );
    const [consumeResult] = await connection.execute(
      `DELETE FROM registration_otps
        WHERE id = ? AND expires_at > UTC_TIMESTAMP(3) AND attempts < 5`,
      [pending.id],
    );
    if (consumeResult.affectedRows !== 1) {
      throw new RegistrationError(410, 'OTP_EXPIRED', 'Mã xác minh đã hết hạn. Hãy đăng ký lại để nhận mã mới.');
    }
    await connection.commit();
    transactionOpen = false;
    user = {
      id: result.insertId,
      username: pending.username,
      fullName: pending.full_name,
      email: pending.email,
      role: 'USER',
    };
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new RegistrationError(409, 'ACCOUNT_EXISTS', 'Tên đăng nhập hoặc email đã được sử dụng.');
    }
    throw error;
  } finally {
    connection.release();
  }

  return user;
}