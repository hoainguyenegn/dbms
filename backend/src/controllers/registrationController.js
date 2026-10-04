import jwt from 'jsonwebtoken';
import { mysqlPool } from '../config/database.js';
import { sendRegistrationCode, hasEmailDeliveryConfig } from '../services/emailService.js';
import { requestRegistration, verifyRegistration } from '../services/registrationService.js';

const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response)).catch(next);
};

export const register = asyncRoute(async (request, response) => {
  if (!hasEmailDeliveryConfig()) {
    return response.status(503).json({
      error: 'EMAIL_NOT_CONFIGURED',
      message: 'Cần cấu hình RESEND_API_KEY và MAIL_FROM để gửi email xác minh.',
    });
  }
  const result = await requestRegistration(mysqlPool, request.body, sendRegistrationCode);
  return response.status(202).json({
    message: 'Mã xác minh đã được gửi. Mã có hiệu lực trong 10 phút.',
    ...result,
  });
});

export const verify = asyncRoute(async (request, response) => {
  const user = await verifyRegistration(mysqlPool, request.body);
  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '8h' },
  );
  return response.status(201).json({ token, user });
});