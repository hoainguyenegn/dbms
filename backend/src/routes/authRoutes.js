import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mysqlPool } from '../config/database.js';
import { requireAuth } from '../middlewares/authenticate.js';
import { register, verify } from '../controllers/registrationController.js';

const router = Router();

router.post('/register', register);
router.post('/verify-registration', verify);

router.post('/login', async (request, response, next) => {
  try {
    const username = typeof request.body?.username === 'string' ? request.body.username.trim() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!username || !password || username.length > 50 || password.length > 200) {
      return response.status(400).json({ error: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.' });
    }

    const [rows] = await mysqlPool.execute(
      'SELECT id, username, password_hash, full_name, email, role FROM users WHERE username = ? LIMIT 1',
      [username],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: 'LOGIN_FAILED', message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    if (!process.env.JWT_SECRET) {
      return response.status(503).json({ error: 'AUTH_UNAVAILABLE', message: 'Xác thực hiện chưa được cấu hình.' });
    }

    const token = jwt.sign(
      { sub: String(user.id), role: user.role },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '8h' },
    );
    return response.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (request, response, next) => {
  try {
    const [rows] = await mysqlPool.execute(
      'SELECT id, username, full_name, email, role FROM users WHERE id = ? LIMIT 1',
      [request.user.id],
    );
    if (!rows[0]) return response.status(401).json({ error: 'INVALID_SESSION', message: 'Tài khoản không còn tồn tại.' });
    const user = rows[0];
    return response.json({ user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

export default router;