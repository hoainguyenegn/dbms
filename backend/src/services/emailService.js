import { RegistrationError } from './registrationService.js';

export function hasEmailDeliveryConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.MAIL_FROM;
  return Boolean(apiKey && apiKey !== 're_your_resend_api_key' && sender);
}

export async function sendRegistrationCode(email, code) {
  if (!hasEmailDeliveryConfig()) {
    throw new RegistrationError(503, 'EMAIL_NOT_CONFIGURED', 'Cần cấu hình RESEND_API_KEY và MAIL_FROM để gửi email.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [email],
      subject: 'Mã xác minh tài khoản EventBox',
      text: `Mã xác minh EventBox của bạn là ${code}. Mã có hiệu lực trong 10 phút.`,
      html: `<p>Mã xác minh EventBox của bạn:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với người khác.</p>`,
    }),
  });

  if (!response.ok) {
    throw new RegistrationError(503, 'EMAIL_DELIVERY_FAILED', 'Email provider từ chối yêu cầu gửi.');
  }
}