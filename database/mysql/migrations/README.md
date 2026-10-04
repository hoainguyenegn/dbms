# Database Schema Migrations (DDL)

Thư mục này dành để lưu trữ các tệp lệnh **Định nghĩa Dữ liệu (Data Definition Language - DDL)** khởi tạo và nâng cấp cấu trúc lược đồ cơ sở dữ liệu MySQL 8.0 cho hệ thống **EventBox**.

---

## 1. Trạng thái Hiện tại của Dự án

Migration `001_init_schema.sql` khởi tạo 9 bảng theo tài liệu thiết kế, gồm các chỉ mục và khóa ngoại phức hợp dùng để giữ nhất quán giữa phiếu giữ, suất diễn, đơn hàng và vé. Migration `002_registration_otps.sql` bổ sung vùng lưu OTP đăng ký có thời hạn.

---

## 2. Quy ước Tên và Thứ tự Thực thi

Khi triển khai các file migration, quy ước đặt tên tuân thủ tiền tố số thứ tự 3 chữ số để đảm bảo tính tuần tự khi chạy:

```
database/mysql/migrations/
└── 001_init_schema.sql    # Khởi tạo 9 bảng, ràng buộc và chỉ mục
└── 002_registration_otps.sql # Lưu OTP đăng ký tạm thời
```

Thứ tự tạo bảng bắt buộc tuân theo mức độ phụ thuộc khóa ngoại (tạo bảng cha trước, bảng con sau):
1. `users` (Tài khoản người dùng & phân quyền RBAC)
2. `events` (Danh mục sự kiện)
3. `event_showings` (Suất diễn / buổi tổ chức - FK `events`)
4. `ticket_types` (Hạng vé & sức chứa - FK `event_showings`)
5. `reservations` (Phiếu giữ vé tạm thời - FK `users`, `event_showings`)
6. `reservation_items` (Chi tiết phiếu giữ vé - FK `reservations`, `ticket_types`)
7. `bookings` (Đơn đặt vé chính thức - FK `reservations`, `users`, `event_showings`)
8. `booking_items` (Chi tiết đơn vé - FK `bookings`, `ticket_types`)
9. `tickets` (Vé điện tử phát hành - FK `bookings`, `booking_items`)

---

## 3. Hướng dẫn Chạy Migration (Local & Cloud DBMS)

### Cách 1: Sử dụng Công cụ Đồ họa (DBeaver / MySQL Workbench)
1. Kết nối vào MySQL Server (Localhost hoặc Cloud Managed Database như Aiven, AWS RDS, TiDB, Railway...).
2. Mở file script migration `.sql`.
3. Nhấn **Execute Script** (Ctrl+Enter / Cmd+Enter).

### Cách 2: Sử dụng Dòng lệnh (CLI)
```bash
mysql -h <HOST> -P <PORT> -u <USER> -p <DATABASE_NAME> < 001_init_schema.sql
```
