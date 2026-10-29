# Bản tích hợp F01–F06

Nhánh tích hợp: `integration/f01-f06`, kết hợp `feature/f01-02-03` và `feature/f05-f06-otp-registration`.

## Các quyết định hợp nhất

- Giữ giao diện quản trị/danh mục/tìm kiếm F01–F03 và thêm `/reserve`, `/checkout`, `/my-tickets` từ F04–F06.
- Một `AuthProvider` quản lý `eventbox_token`. BookingPage và ReservationPage dùng chung context; phiên `eventbox-session` cũ được chuyển sang token chung sau khi xác thực `/me`.
- Đăng nhập bằng email; API vẫn chấp nhận username của tài khoản demo cũ. JWT mới dùng `sub`; middleware chung còn đọc `id` của token cũ đến khi hết hạn.
- Đăng ký qua `/api/auth/register` với `{email, full_name, password}` rồi `/api/auth/verify-registration` với `{email, code}`. Khi chưa có username, backend dùng email làm username. OTP HMAC, 10 phút, tối đa 5 lần sai, gửi lại sau 60 giây. Không còn đăng ký trực tiếp bỏ qua OTP hoặc luồng OTP RAM cũ.
- SMTP cấu hình sẵn được ưu tiên; nếu không có SMTP, dùng Resend. Không gửi email ra ngoài trong kiểm thử tích hợp.
- Giữ schema F01–F03: `subtotal_vnd` tự tính, showing_code duy nhất trong event. Booking service không chèn giá trị vào cột tự tính.
- Migration OTP đổi từ `002_registration_otps.sql` thành `003_registration_otps.sql`. Tên bảng giữ nguyên nên database đã có bảng không bị tạo trùng.
- Thao tác giữ/xác nhận/hủy khóa event trước showing và reservation/booking, cùng thứ tự với quản trị. Giao dịch đặt vé dùng READ COMMITTED để phép tính tồn không đọc snapshot cũ sau khi chờ khóa.
- Bản sửa khởi động server khi cổng bị chiếm được giữ lại.

## Chạy trên máy đã có database

Chạy trong thư mục gốc repo:

```sh
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run migrate
npm --prefix backend run dev
```

Terminal khác:

```sh
npm --prefix frontend run dev
```

Mở `http://localhost:5173`. Chọn sự kiện → Chọn vé → Giữ vé → Xác nhận → Vé của tôi. Tài khoản MANAGER dùng Quản lý sự kiện → Chi tiết / Chỉnh sửa.

`.env` ở thư mục gốc repo là cấu hình chung. MYSQL_PASSWORD phải là mật khẩu thực của user trong container/database; sửa `.env` không đổi mật khẩu MySQL. Cần JWT_SECRET và một trong hai bộ cấu hình SMTP hoặc Resend để gửi OTP.

`npm run migrate` chỉ nâng cấp schema: chạy migration 002, 003, mở rộng username lên 254 ký tự, chuyển subtotal cũ sang cột tự tính nếu cần. Nếu subtotal lịch sử lệch với đơn giá × số lượng, lệnh dừng để kiểm tra trước khi chuyển. Không chạy lại seed trên database có dữ liệu người dùng. Database mới qua Docker Compose tự áp dụng schema, migrations và seed.

## Kiểm chứng

```sh
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend run test:integration:docker
```

Test Docker yêu cầu container `eventbox-mysql` và `eventbox-redis`. Runner đọc cấu hình container, tạo schema `eventbox_integration_<random>`, mô phỏng schema cũ, chạy migration hai lần, kiểm tra API HTTP với MySQL/Redis thật rồi xóa schema thử. Không thay dữ liệu ứng dụng. Kiểm tra cả UTF-8, phân quyền, OTP, đăng nhập chung, catalog, idempotency, chống bán vượt tồn, quyền sở hữu, hủy đơn và đóng sự kiện đồng thời xác nhận.

`npm test` chạy các test không cần database; hai test MySQL opt-in được bỏ qua mặc định. Kiểm thử gửi thư thật chưa được thực hiện; OTP được nhận bằng callback trong test, không gọi nhà cung cấp email.
