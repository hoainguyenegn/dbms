# F01–F03: triển khai và kiểm tra

## Quy tắc dữ liệu

- Tạo sự kiện luôn bắt đầu ở DRAFT. Tùy chọn `publish_now: true` tạo toàn bộ danh mục và kiểm tra điều kiện công bố trong cùng transaction; lỗi rollback toàn bộ.
- Sửa danh mục chỉ khi DRAFT. Mọi thao tác ghi khóa sự kiện cha trước khi sửa/xóa danh mục hoặc chuyển trạng thái.
- Chỉ cho phép DRAFT → PUBLISHED → CLOSED. Công bố yêu cầu mỗi suất có vé, lịch hợp lệ, ngừng bán ở tương lai theo thời gian MySQL.
- Xóa danh mục nháp chạy trong transaction; khóa ngoại chặn dữ liệu lịch sử và lỗi rollback toàn bộ.
- ID nguyên dương; tên không rỗng; giá VND nguyên 0..1.000.000.000; capacity nguyên 1..100.000. Không tự chuyển giá sai thành 0 hoặc capacity sai thành 100.
- `showing_code` bất biến, duy nhất trong từng event. Tên loại vé (`type_name`) duy nhất trong từng showing; schema hiện tại dùng ID làm định danh bất biến, không có trường mã loại vé riêng.
- Số liệu công khai lấy từ MySQL. Tồn = capacity − tổng CONFIRMED − tổng ACTIVE chưa hết hạn.
- Bộ lọc from/to theo [from, to). Ngày hoặc giờ không có offset được hiểu ở Việt Nam (+07:00), chuyển sang UTC. Client gửi datetime-local dưới dạng ISO có offset/UTC.
- Thẻ sự kiện lấy thời gian, địa điểm, giá thấp nhất và trạng thái bán từ cùng suất phù hợp sớm nhất. Bộ lọc áp dụng trước khi chọn suất và phân trang.

## API quản trị bổ sung

Các endpoint đều được bảo vệ bởi verifyToken + requireManager.

- GET `/api/admin/events/:id`: chi tiết sự kiện kể cả DRAFT/CLOSED, gồm showings và ticket_types.
- PATCH `/api/admin/events/:id`: title, category, description. Trường khác bị từ chối.
- PATCH `/api/admin/events/:eventId/showings/:id`: venue_name, city_code và bốn mốc thời gian.
- DELETE `/api/admin/events/:eventId/showings/:id`.
- PATCH `/api/admin/showings/:showingId/ticket-types/:id`: type_name, price_vnd, capacity.
- DELETE `/api/admin/showings/:showingId/ticket-types/:id`.

URL có cha kiểm tra đối tượng con thuộc đúng cha. Các URL phẳng cũ vẫn được giữ tương thích, xác định cha trực tiếp từ DB.

## Nâng cấp database đã tồn tại

```sh
npm --prefix backend run migrate:showing-scope
```

Migration chỉ thay unique index của showing_code, giữ nguyên bản ghi; chạy lại an toàn. Database mới qua Compose tự áp dụng.

## Kiểm tra

```sh
npm --prefix backend run test:catalog
npm --prefix backend run test:catalog:mysql
npm --prefix frontend run build
cd frontend
./node_modules/.bin/eslint src/pages/HomePage.jsx src/pages/AdminEventsPage.jsx src/components/EventDetailModal.jsx src/components/EventCatalogEditor.jsx
```

Bộ test MySQL là opt-in, kết nối database trong `.env`, tạo fixture trong transaction và rollback sau khi chạy. AUTO_INCREMENT có thể tăng dù rollback; không dùng test này để kiểm tra số ID liên tiếp. Test không chứng minh đầy đủ tranh chấp nhiều kết nối với F04/F05: các thành viên tích hợp cần cùng tuân theo thứ tự khóa sự kiện cha và kiểm tra lại trạng thái trong transaction.

Kiểm tra giao diện thủ công: đăng nhập MANAGER → tạo nháp → Chi tiết / Chỉnh sửa → thêm/sửa/xóa suất và vé → công bố. Trang công khai phải hiển thị đúng suất, giá 0, bộ lọc ngày và phân trang. Khi ngắt API phải có lỗi và nút Thử lại.
