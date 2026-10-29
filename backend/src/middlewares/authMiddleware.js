import { requireAuth } from './authenticate.js';
export const verifyToken = requireAuth;
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' });
    next();
  };
}
export const requireManager = requireRole('MANAGER');
export const requireUser = requireRole('USER');
