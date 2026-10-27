# Backend API

## Cấu hình

1. Sao chép `.env.example` thành `.env` ở thư mục gốc dự án.
2. Điền cấu hình MySQL và `JWT_SECRET`.
3. Để gửi OTP đăng ký, điền `RESEND_API_KEY` và `MAIL_FROM`. Địa chỉ gửi cần được Resend cho phép; không commit token thật.
4. Chạy lần lượt `database/mysql/migrations/001_init_schema.sql` và `002_registration_otps.sql` trên MySQL 8.0+.

## API Transaction

- `POST /api/auth/register`: tạo yêu cầu đăng ký và gửi OTP.
- `POST /api/auth/verify-registration`: xác minh email, tạo tài khoản và trả JWT.
- `GET /api/showings/on-sale`: danh sách suất diễn đang mở bán, giá và tồn khả dụng.
- `POST /api/reservations`: tạo phiếu giữ vé F04 bằng `request_key`, `showing_id`, `items`.
- `GET /api/reservations/:reservationId`: đọc trạng thái phiếu giữ của chủ sở hữu.
- `POST /api/reservations/:reservationId/release`: bỏ giữ vé.
- `POST /api/bookings/confirm` hoặc `POST /api/reservations/:reservationId/confirm`: xác nhận phiếu giữ vé.
- `GET /api/bookings/my` hoặc `GET /api/me/bookings`: lịch sử đơn của người dùng đăng nhập.
- `GET /api/bookings/:bookingCode`: chi tiết đơn và mã vé.
- `POST /api/bookings/:bookingCode/cancel`: hủy toàn bộ đơn trước giờ diễn.

Các endpoint giữ/đọc/nhả reservation và booking yêu cầu Bearer JWT của tài khoản `USER`; danh sách suất đang mở bán là public. F04 khóa hàng suất diễn trong MySQL để serialize việc giữ/xác nhận và ghi reservation/items trong transaction. Redis Lua ghi/xóa cache giữ vé với TTL; MySQL vẫn là nguồn quyết định, nên Redis không sẵn sàng thì thao tác giữ vẫn được kiểm tra và ghi bởi MySQL. OTP tồn tại 10 phút, tối đa 5 lần nhập sai; user chỉ được tạo sau khi xác minh thành công.

## Kiểm thử

```bash
npm --prefix backend test
```
