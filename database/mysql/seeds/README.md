# Dữ liệu mẫu local

`001_seed_fixture.sql` cung cấp danh mục sự kiện, suất diễn và loại vé cho bản chung. Chạy sau schema/migrations khi khởi tạo database mới; Docker Compose tự chạy ở lần tạo volume đầu tiên.

| Email | Mật khẩu demo | Vai trò |
| --- | --- | --- |
| manager@eventbox.vn | password123 | MANAGER |
| customer1@gmail.com | password123 | USER |
| customer2@gmail.com | password123 | USER |

Mật khẩu chỉ dành cho fixture local. Database đã tồn tại giữ nguyên tài khoản/mật khẩu trước đó; không tự cập nhật khi chạy migration.

Không cần seed booking cố định: đăng nhập USER, chọn vé, giữ vé và xác nhận qua giao diện để tạo đơn. Không chạy seed reset đơn/vé từ nhánh cũ trên database dùng chung. Các mốc thời gian seed là UTC trong tháng 11–12/2026; khi demo sau đó cần tạo sự kiện với lịch còn hiệu lực.
