# MySQL migrations

- `001_init_schema.sql`: khởi tạo 9 bảng quan hệ.
- `002_showing_code_scope.sql`: chuyển mã suất diễn từ duy nhất toàn hệ thống sang duy nhất trong từng sự kiện (BR-01). Không xóa dữ liệu; có thể chạy lại.

Cơ sở dữ liệu mới dùng Docker Compose sẽ tự khởi tạo schema và seed. Với database đã tồn tại, chọn đúng database trong MySQL Workbench rồi chạy `002_showing_code_scope.sql`. Không xóa Docker volume để nâng cấp.

```sh
mysql -h <HOST> -P <PORT> -u <USER> -p <DATABASE_NAME> < database/mysql/migrations/002_showing_code_scope.sql
```

Ứng dụng đọc/ghi DATETIME theo UTC. Pool thiết lập `time_zone = '+00:00'` cho mỗi kết nối.
