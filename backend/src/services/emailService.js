import nodemailer from 'nodemailer';

let etherealTransporter = null;

/**
 * Khởi tạo bộ vận chuyển email (Transporter)
 */
async function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const service = process.env.SMTP_SERVICE; // ví dụ: 'gmail'

  // 1. Nếu có cấu hình SMTP thực tế (như Gmail App Password hoặc custom SMTP)
  if (user && pass) {
    if (service) {
      return nodemailer.createTransport({
        service,
        auth: { user, pass },
      });
    }

    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  // 2. Tự động khởi tạo tài khoản kiểm thử Ethereal Email khi chưa có cấu hình SMTP
  if (!etherealTransporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email Service] Đã tạo phiên Ethereal Email: ${testAccount.user}`);
    } catch (err) {
      console.warn('[Email Service] Không thể tạo tài khoản Ethereal:', err.message);
    }
  }

  return etherealTransporter;
}

/**
 * Gửi email chứa mã xác thực OTP
 */
export async function sendOtpEmail({ to, otp, fullName = 'Quý khách' }) {
  const subject = `[EventBox] Mã xác thực đăng ký tài khoản: ${otp}`;
  const expireMinutes = 5;

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 30px 10px; margin: 0;">
    <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.04);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #e63946; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">EventBox</h1>
        <p style="color: #64748b; font-size: 14px; margin: 6px 0 0;">Xác thực địa chỉ email</p>
      </div>

      <p style="color: #334155; font-size: 14.5px; line-height: 1.6; margin: 0 0 20px;">
        Xin chào <strong>${fullName}</strong>,<br>
        Bạn vừa yêu cầu đăng ký tài khoản tại hệ thống EventBox. Dưới đây là mã xác thực (OTP) của bạn:
      </p>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 0 0 24px;">
        <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Mã xác thực OTP</div>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a; font-family: monospace;">${otp}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Hiệu lực trong vòng ${expireMinutes} phút</div>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 20px;">
        Vui lòng không chia sẻ mã này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
      </p>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; text-align: center; color: #94a3b8; font-size: 12px;">
        © 2026 EventBox — Nền tảng đặt vé sự kiện trực tuyến.
      </div>
    </div>
  </body>
  </html>
  `.trim();

  try {
    const transporter = await getTransporter();

    if (!transporter) {
      throw new Error('Chưa thể khởi tạo bộ gửi email.');
    }

    const fromAddress = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"EventBox" <${process.env.SMTP_USER}>` : '"EventBox" <no-reply@eventbox.vn>');

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: `Mã xác thực OTP của bạn tại EventBox là: ${otp}. Mã có hiệu lực trong ${expireMinutes} phút.`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email Sent] Xem hộp thư xem thử tại: ${previewUrl}`);
    } else {
      console.log(`[Email Sent] Đã gửi thư thành công tới ${to} (Message ID: ${info.messageId})`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || undefined,
    };
  } catch (error) {
    console.error('[Email Error] Gửi email thất bại:', error.message);
    throw new Error(`Không thể gửi email xác thực: ${error.message}`);
  }
}
