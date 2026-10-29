# EventBox API

API chung F01–F06 dùng MySQL 8 và Redis 7. Hướng dẫn tích hợp chi tiết: [docs/integration-f01-f06.md](../docs/integration-f01-f06.md).

Từ thư mục gốc repo:

```sh
npm --prefix backend install
npm --prefix backend run migrate
npm --prefix backend run dev
```

Database mới: khởi tạo qua `docker compose up -d mysql redis`. Database đã có: chỉ chạy `npm --prefix backend run migrate`, không chạy lại schema/seed.

`.env` ở thư mục gốc: MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, REDIS_HOST, REDIS_PORT, JWT_SECRET, FRONTEND_URL. OTP dùng SMTP_USER/SMTP_PASS (SMTP_SERVICE hoặc SMTP_HOST/PORT/SECURE) hoặc RESEND_API_KEY/MAIL_FROM.

Auth:

- POST `/api/auth/register`: email, full_name, password; tạo yêu cầu OTP, chưa tạo user.
- POST `/api/auth/verify-registration`: email, code; tạo tài khoản và trả JWT.
- POST `/api/auth/login`: email hoặc username, password; trả JWT.
- GET `/api/auth/me`: Bearer JWT.
- POST `/api/auth/logout`: frontend xóa token; JWT có hiệu lực đến hết hạn.

Routes `/api/admin/*` dành cho MANAGER. `/api/events*` và `/api/showings/on-sale` công khai. Routes reservations/bookings kiểm tra USER và quyền sở hữu.

```sh
npm --prefix backend test
npm --prefix backend run test:integration:docker
```

Runner tích hợp Docker dùng database thử riêng và tự dọn dẹp, không gửi email.
