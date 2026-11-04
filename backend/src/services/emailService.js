import nodemailer from 'nodemailer';
import { RegistrationError } from './registrationService.js';

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}
function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your_resend_api_key' && process.env.MAIL_FROM);
}
export function hasEmailDeliveryConfig() {
  return hasSmtpConfig() || hasResendConfig();
}
export async function sendRegistrationCode(email, code) {
  const subject = '[EventBox] Mã xác minh tài khoản';
  const text = `Mã xác minh EventBox của bạn là ${code}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với người khác.`;
  const html = `<p>Mã xác minh tài khoản EventBox:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với người khác.</p>`;
  if (hasSmtpConfig()) {
    const transporter = nodemailer.createTransport({
      ...(process.env.SMTP_SERVICE ? { service: process.env.SMTP_SERVICE } : {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
      }),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject, text, html });
  }
  if (!hasResendConfig()) throw new RegistrationError(503, 'EMAIL_NOT_CONFIGURED', 'Chưa cấu hình SMTP hoặc Resend để gửi email xác minh.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [email], subject, text, html }),
  });
  if (!response.ok) throw new RegistrationError(503, 'EMAIL_DELIVERY_FAILED', 'Chưa gửi được email xác minh. Vui lòng thử lại.');
}
