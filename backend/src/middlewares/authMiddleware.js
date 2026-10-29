import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'eventbox_super_secret_jwt_key_2026_hk261';

/**
 * Middleware xác thực danh tính người dùng qua JWT Token (Authentication)
 * Đọc token từ Header: Authorization: Bearer <token>
 */
export function verifyToken(request, response, next) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return response.status(401).json({
      error: 'MISSING_TOKEN',
      message: 'Yêu cầu không có mã xác thực hoặc sai định dạng Bearer.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Gán thông tin người dùng giải mã vào request để các controller phía sau sử dụng
    request.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    return response.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Mã xác thực không hợp lệ.',
    });
  }
}

/**
 * Middleware phân quyền dựa trên vai trò (Role-Based Access Control - RBAC)
 * @param  {...string} allowedRoles Danh sách vai trò được phép truy cập ('USER', 'MANAGER')
 */
export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Bạn chưa đăng nhập vào hệ thống.',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return response.status(403).json({
        error: 'FORBIDDEN',
        message: 'Bạn không có quyền hạn truy cập tài nguyên này.',
      });
    }

    return next();
  };
}

/**
 * Tiện ích kiểm tra quyền Quản trị viên (MANAGER)
 */
export const requireManager = requireRole('MANAGER');

/**
 * Tiện ích kiểm tra quyền Khách hàng (USER)
 */
export const requireUser = requireRole('USER');

