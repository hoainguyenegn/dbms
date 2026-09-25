# Database Schema Migrations (DDL)

Thư mục này dành để lưu trữ các tệp lệnh **Định nghĩa Dữ liệu (Data Definition Language - DDL)** khởi tạo và nâng cấp cấu trúc lược đồ cơ sở dữ liệu MySQL 8.0 cho hệ thống **EventBox**.

---

## 1. Trạng thái Hiện tại của Dự án

> [!NOTE]
> **Giai đoạn Hiện tại:** Nhóm đang ở giai đoạn **Thiết kế & Mô tả Cơ sở Dữ liệu**. 
> - Toàn bộ cấu trúc bảng quan hệ, khóa chính (PK), khóa ngoại (FK), ràng buộc kiểm tra (`CHECK constraints`) và các chỉ mục đã được quy định chi tiết tại **[Tài liệu Thiết kế & Mô tả Cơ sở Dữ liệu (docs/database-design.md)](../../../docs/database-design.md)**.
> - Các file script migration `.sql` chính thức sẽ được sinh mã và lưu tại thư mục này ở giai đoạn tiếp theo của đồ án.

---

## 2. Quy ước Tên và Thứ tự Thực thi

Khi triển khai các file migration, quy ước đặt tên tuân thủ tiền tố số thứ tự 3 chữ số để đảm bảo tính tuần tự khi chạy:

```
database/mysql/migrations/
└── 001_init_schema.sql    # Khởi tạo toàn bộ cấu trúc 9 bảng quan hệ và ràng buộc
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
