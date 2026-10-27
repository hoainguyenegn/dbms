# MySQL Seed Fixtures

Chạy `001_seed_fixture.sql` sau migrations `001_init_schema.sql` và `002_registration_otps.sql` để nạp dữ liệu demo EventBox. Script dùng mã nghiệp vụ cố định và `ON DUPLICATE KEY UPDATE`, nên có thể chạy lại để reset fixture.

## Tài khoản demo

| Username | Password | Role |
| --- | --- | --- |
| `user01` | `EventBoxDemo123!` | `USER` |
| `manager01` | `EventBoxManager123!` | `MANAGER` |

Đây là thông tin giả lập cho môi trường local/demo, không dùng lại mật khẩu này ở môi trường thật.

## Fixture booking

- Reservation `f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73`: trạng thái `ACTIVE`, giữ 2 vé Standard, hết hạn sau 5 phút. Dùng UUID này với `POST /api/bookings/confirm` sau khi đăng nhập bằng `user01`.
- Booking `BK-DEMO-CONFIRMED`: 2 vé Standard, tổng 700.000 VND; dùng để xem lịch sử hoặc thử hủy trước giờ diễn.
- Booking `BK-DEMO-CANCELLED`: 1 vé VIP, tổng 750.000 VND; dùng để xác nhận đơn hủy vẫn còn trong lịch sử và vé mất hiệu lực.

Suất diễn được đặt tương đối theo UTC: đang mở bán, diễn ra sau khoảng 8 ngày. Reservation active hết hạn sau 5 phút kể từ lúc chạy seed.

## Chạy bằng MySQL CLI

Chọn database trước hoặc truyền database ở cuối lệnh:

```bash
mysql -h <HOST> -P <PORT> -u <USER> -p <DATABASE_NAME> < database/mysql/seeds/001_seed_fixture.sql
```
