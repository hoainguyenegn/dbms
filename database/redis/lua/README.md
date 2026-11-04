# Redis Lua Scripts (F04)

Các script chạy qua Redis `EVAL` để thao tác cache giữ vé nguyên tử. Dữ liệu chuẩn của reservation, trạng thái và tồn vé vẫn nằm trong MySQL theo BR-21.

## `reserve.lua`

- Nhận một Redis key riêng cho reservation, TTL mili-giây và các dòng loại vé.
- Kiểm tra tất cả dòng đủ capacity trước khi ghi; thiếu một dòng thì không ghi key nào.
- Khi hợp lệ, ghi owner, showing, request key, expiry và JSON items vào hash rồi đặt TTL trong cùng lệnh Lua.
- MySQL khóa hàng `event_showings` trước khi tính capacity, kiểm tra sold/held và commit reservation cùng reservation items. Lua là bước cache atomic sau commit; cache miss/Redis down không được dùng để kết luận MySQL reservation đã hết hạn.

## `release.lua`

- So sánh `user_id` lưu trong cache với chủ sở hữu yêu cầu rồi mới xóa key.
- Backend cập nhật trạng thái `RELEASED`/`EXPIRED` trong transaction MySQL trước. Redis chỉ được xóa sau commit; lỗi cache không phục hồi reservation.

TTL được tính đến `expires_at` đã lưu ở MySQL và không vượt thời điểm ngừng bán. Redis mất dữ liệu có thể làm mất cache, không làm mất lịch sử hoặc thay đổi trạng thái MySQL.
