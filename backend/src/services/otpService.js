import crypto from 'node:crypto';
import { redisClient } from '../config/database.js';

// Bộ nhớ tạm Fallback (Memory Store) khi Redis không khả dụng
const memoryOtpStore = new Map();
const memoryVerifiedStore = new Map();

const OTP_TTL_SECONDS = 300; // 5 phút
const VERIFIED_TTL_SECONDS = 600; // 10 phút

/**
 * Lưu mã OTP của một email
 */
export async function saveOtp(email, otp, fullName) {
  const normalizedEmail = email.trim().toLowerCase();
  const data = {
    otp: String(otp),
    fullName: fullName ? fullName.trim() : '',
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };

  // 1. Thử lưu vào Redis
  try {
    if (redisClient?.isOpen) {
      await redisClient.setEx(
        `otp:register:${normalizedEmail}`,
        OTP_TTL_SECONDS,
        JSON.stringify(data)
      );
      return;
    }
  } catch (err) {
    console.warn('Redis OTP save warning:', err.message);
  }

  // 2. Fallback: Lưu vào bộ nhớ RAM
  memoryOtpStore.set(normalizedEmail, data);
  setTimeout(() => memoryOtpStore.delete(normalizedEmail), OTP_TTL_SECONDS * 1000);
}

/**
 * Kiểm tra và đối chiếu mã OTP
 */
export async function verifyOtp(email, inputOtp) {
  const normalizedEmail = email.trim().toLowerCase();
  let data = null;

  // 1. Đọc từ Redis nếu có
  try {
    if (redisClient?.isOpen) {
      const raw = await redisClient.get(`otp:register:${normalizedEmail}`);
      if (raw) data = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Redis OTP get warning:', err.message);
  }

  // 2. Đọc từ Memory Store nếu Redis không có
  if (!data) {
    data = memoryOtpStore.get(normalizedEmail);
  }

  if (!data) {
    return {
      valid: false,
      error: 'OTP_EXPIRED',
      message: 'Mã xác thực OTP đã hết hạn hoặc chưa được gửi. Vui lòng yêu cầu mã mới.',
    };
  }

  if (data.attempts >= 5) {
    // Xóa mã nếu nhập sai quá 5 lần
    if (redisClient?.isOpen) await redisClient.del(`otp:register:${normalizedEmail}`).catch(() => {});
    memoryOtpStore.delete(normalizedEmail);
    return {
      valid: false,
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu gửi lại mã OTP mới.',
    };
  }

  // Đối chiếu mã OTP
  if (data.otp !== String(inputOtp).trim()) {
    data.attempts += 1;
    if (redisClient?.isOpen) {
      await redisClient.setEx(
        `otp:register:${normalizedEmail}`,
        Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000)),
        JSON.stringify(data)
      ).catch(() => {});
    }
    return {
      valid: false,
      error: 'INVALID_OTP',
      message: `Mã OTP không chính xác. Bạn còn ${5 - data.attempts} lần thử.`,
    };
  }

  // Mã OTP chính xác -> Tạo vé xác thực verification_token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verifiedData = {
    email: normalizedEmail,
    fullName: data.fullName,
    verifiedAt: Date.now(),
  };

  // Xóa mã OTP đã dùng
  if (redisClient?.isOpen) {
    await redisClient.del(`otp:register:${normalizedEmail}`).catch(() => {});
    await redisClient.setEx(
      `otp:verified:${verificationToken}`,
      VERIFIED_TTL_SECONDS,
      JSON.stringify(verifiedData)
    ).catch(() => {});
  }
  memoryOtpStore.delete(normalizedEmail);
  memoryVerifiedStore.set(verificationToken, verifiedData);
  setTimeout(() => memoryVerifiedStore.delete(verificationToken), VERIFIED_TTL_SECONDS * 1000);

  return {
    valid: true,
    verificationToken,
    fullName: data.fullName,
  };
}

/**
 * Kiểm tra tính hợp lệ của vé xác thực (Verification Token) trước khi tạo mật khẩu
 */
export async function getVerifiedData(verificationToken) {
  if (!verificationToken) return null;

  try {
    if (redisClient?.isOpen) {
      const raw = await redisClient.get(`otp:verified:${verificationToken}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Redis verified get warning:', err.message);
  }

  return memoryVerifiedStore.get(verificationToken) || null;
}

/**
 * Hủy vé xác thực sau khi hoàn tất tạo tài khoản
 */
export async function consumeVerifiedToken(verificationToken) {
  if (!verificationToken) return;
  try {
    if (redisClient?.isOpen) {
      await redisClient.del(`otp:verified:${verificationToken}`).catch(() => {});
    }
  } catch (err) {
    console.warn('Redis verified del warning:', err.message);
  }
  memoryVerifiedStore.delete(verificationToken);
}

