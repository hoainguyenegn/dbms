import jwt from 'jsonwebtoken';

export function requireAuth(request, response, next) {
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ error: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập để tiếp tục.' });
  }

  if (!process.env.JWT_SECRET) {
    return response.status(503).json({ error: 'AUTH_UNAVAILABLE', message: 'Xác thực hiện chưa được cấu hình.' });
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const id = Number(claims.sub);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid token subject');
    request.user = { id, role: claims.role };
    return next();
  } catch {
    return response.status(401).json({ error: 'INVALID_TOKEN', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
}

export function requireCustomer(request, response, next) {
  if (request.user?.role !== 'USER') {
    return response.status(403).json({ error: 'FORBIDDEN', message: 'Chức năng này chỉ dành cho khách hàng.' });
  }
  return next();
}