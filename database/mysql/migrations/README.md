# MySQL migrations

- `001_init_schema.sql`: schema chung cho 9 bảng quan hệ, dùng cho database mới.
- `002_showing_code_scope.sql`: showing_code duy nhất trong từng event.
- `003_registration_otps.sql`: bảng OTP dùng chung, tên cũ trên nhánh F05/F06 là `002_registration_otps.sql`.

Với database đã tồn tại, chạy từ thư mục gốc:

```sh
npm --prefix backend run migrate
```

Runner chạy 002/003, mở rộng username để hỗ trợ email, chuyển subtotal_vnd sang cột tự tính khi cần. Chỉ chuyển khi tất cả subtotal hiện có bằng unit_price_vnd × quantity; nếu lệch, dừng để kiểm tra. Chạy lại an toàn. DDL MySQL tự commit, nên cần sao lưu trước khi nâng cấp database có dữ liệu quan trọng.

Database mới qua Docker Compose tự khởi tạo schema/migrations/seed. Không xóa volume hoặc chạy lại seed để nâng cấp. Kết nối ứng dụng dùng UTF-8 và UTC.
