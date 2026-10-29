import { Router } from 'express';
import {
  sendRegisterOtp,
  verifyRegisterOtp,
  completeRegisterWithPassword,
  register,
  login,
  getMe,
  logout,
} from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// ── Quy trình Đăng ký tài khoản bằng OTP (Email là định danh duy nhất) ──
// Bước 1: Gửi mã OTP xác nhận về Email
router.post('/register/send-otp', sendRegisterOtp);

// Bước 2: Xác thực mã OTP nhận được
router.post('/register/verify-otp', verifyRegisterOtp);

// Bước 3: Tạo mật khẩu đăng nhập & Hoàn tất tạo tài khoản
router.post('/register/complete', completeRegisterWithPassword);

// Đăng ký trực tiếp (Tương thích ngược)
router.post('/register', register);

// ── Đăng nhập hệ thống (Email + Password) ──
router.post('/login', login);

// ── Thông tin tài khoản hiện tại & Đăng xuất ──
router.get('/me', verifyToken, getMe);
router.post('/logout', verifyToken, logout);

export default router;
