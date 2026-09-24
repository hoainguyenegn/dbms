# Kế hoạch kiểm thử, demo và đối chiếu yêu cầu

Mã tài liệu: ETS-TEST | Phiên bản: 1.0 | Ngày: 2026-09-21

Tài liệu xác định kế hoạch kiểm thử, kịch bản demo ứng dụng và phương pháp thực nghiệm trên hai hệ quản trị cơ sở dữ liệu MySQL 8.x và Redis 7.x cho Đồ án môn Cơ sở dữ liệu (DBMS).

Nhóm thực hiện gồm 3 thành viên phụ trách 3 chủ đề độc lập:
- **Thành viên 1:** Data Storage & Management (F01, F02, F03 và mô hình dữ liệu).
- **Thành viên 2:** Transaction (F05, F06; quy trình xác nhận đặt vé, sinh mã vé và hủy đơn).
- **Thành viên 3:** Concurrency (F04, F07; giữ vé tạm thời có thời hạn, tranh chấp tồn vé và thống kê).

Giao diện trang chủ chung của dự án là trang web tĩnh đơn giản giới thiệu Đồ án DBMS. Đối với các chức năng nghiệp vụ và thực nghiệm, mỗi thành viên tự xây dựng giao diện (UI) hoặc màn hình demo độc lập phù hợp với phạm vi phân công của mình.

---

## 1. Mục tiêu và câu hỏi nghiên cứu

Bộ thực nghiệm đối chiếu giữa MySQL và Redis tập trung vào các câu hỏi kỹ thuật:

1. **Biểu diễn dữ liệu:** Cùng dữ liệu nghiệp vụ (danh mục sự kiện, buổi tổ chức, loại vé, phiếu giữ) được biểu diễn và thao tác khác nhau thế nào giữa mô hình quan hệ (bảng, khóa ngoại) và NoSQL (Hash, Set, String)?
2. **Ràng buộc toàn vẹn:** Tính duy nhất (UNIQUE) và tính toàn vẹn tham chiếu (FOREIGN KEY) do DBMS tự kiểm soát hay ứng dụng phải tự xử lý?
3. **Duy trì dữ liệu dẫn xuất:** Khi cập nhật hoặc xóa dữ liệu cha, ứng dụng phải tự đồng bộ các tập chỉ mục/mapping phụ trợ ở Redis ra sao so với cơ chế CASCADE/Index của MySQL?
4. **Độ bền vững (Persistence):** Dữ liệu có được đảm bảo nguyên vẹn sau khi restart dịch vụ bình thường không?
5. **Định vị vai trò kiến trúc:** Dựa trên bằng chứng thực nghiệm, mỗi hệ quản trị phù hợp với vai trò nào trong kiến trúc tổng thể của hệ thống?

---

## 2. Môi trường và điều kiện an toàn thực nghiệm

- Sử dụng cơ sở dữ liệu MySQL và Redis cục bộ (local). Tách biệt schema/namespace phục vụ bài lab thực nghiệm khỏi cơ sở dữ liệu chính của ứng dụng.
- Dữ liệu thử nghiệm ở cả hai DBMS được khởi tạo (seed) từ cùng một tập dữ liệu mẫu (fixture) logic để đảm bảo tính tương đương khi đối chiếu.
- Mỗi ca kiểm thử bắt đầu từ trạng thái dữ liệu sạch. Ghi nhận rõ ràng: dữ liệu đầu vào, thao tác thực hiện, kết quả thực tế và dữ liệu sau thao tác.
- Tuyệt đối không xóa dữ liệu dùng chung (tránh `FLUSHALL` hoặc xóa toàn bộ database khi đang kiểm thử).

---

## 3. Dữ liệu mẫu logic (Fixture)

Phiên bản fixture: `ets-fixture-v1`. Các mốc thời gian là thời điểm tương lai giả định trước ngày `2030-06-10T12:00:00Z`.

### 3.1. Danh mục sự kiện, buổi tổ chức và loại vé

| ID Sự kiện | Mã sự kiện | Tên sự kiện | Thể loại | Trạng thái | Buổi (Showing ID) | Địa điểm / Giờ bắt đầu (UTC) | Loại vé (ID, Tên, Giá, Số lượng) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 101 | EVT-DATA-101 | Đêm hội dữ liệu | WORKSHOP | PUBLISHED | 1011 | Hội trường demo A<br>2030-06-10T12:00:00Z | 10111: Standard (250.000 VND, 100 vé)<br>10112: VIP (500.000 VND, 20 vé) |
| 102 | EVT-WORKSHOP-102 | Hội thảo Cơ sở dữ liệu | WORKSHOP | DRAFT | 1021 | Phòng lab B<br>2030-06-12T02:00:00Z | 10211: Standard (200.000 VND, 50 vé) |
| 103 | EVT-MUSIC-103 | Đêm nhạc sinh viên | MUSIC | PUBLISHED | 1031 | Sân khấu C<br>2030-06-11T12:00:00Z | 10311: GA (150.000 VND, 200 vé) |

### 3.2. Dữ liệu đơn hàng mẫu (MySQL)

- **Khách 201:** `Khách mẫu 01` (`customer01@example.com`).
- **Khách 202:** `Khách mẫu 02` (`customer02@example.com`).
- **Đơn 501:** Khách 201, Buổi 1011, trạng thái `CONFIRMED`, gồm 2 vé loại Standard (đơn giá 250.000 VND, tổng 500.000 VND), phát hành 2 mã vé: `TKT-501-1`, `TKT-501-2`.
- **Đơn 502:** Khách 202, Buổi 1011, trạng thái `CANCELLED` (đã hủy hợp lệ trước giờ bắt đầu), gồm 1 vé loại VIP (đơn giá 500.000 VND).

---

## 4. Bộ thực nghiệm Data Storage & Management (Thành viên 1)

Mỗi bài kiểm thử so sánh cách triển khai, lệnh thực thi và phản ứng giữa MySQL và Redis:

| Mã | Thao tác | Kết quả mong đợi & Nội dung đối chiếu | Liên kết yêu cầu |
| --- | --- | --- | --- |
| TC-S01 | Tạo mới sự kiện DRAFT 104, thêm buổi và loại vé hợp lệ trên cả 2 DBMS | Bản ghi được tạo thành công, đúng cấu trúc logic. Không ảnh hưởng đến dữ liệu của 3 sự kiện cũ | F01, F02; BR-01, BR-02 |
| TC-S02 | Cố tình tạo sự kiện mới với mã trùng sau khi chuẩn hóa: ` evt-workshop-102 ` | Cả hai bên từ chối trùng lặp. Đối chiếu: MySQL dùng ràng buộc `UNIQUE`; Redis phải kiểm tra qua `Set` hoặc khóa quản lý mã | F01; BR-01 |
| TC-S03 | Thêm loại vé vào `showing_id = 999` (buổi không tồn tại) | Bị từ chối. Đối chiếu: MySQL chặn bằng FOREIGN KEY tự động; Redis Hash không có FK native nên ứng dụng phải tự kiểm tra | F02; BR-02 |
| TC-S04 | Sửa sự kiện 102 DRAFT (đổi địa điểm) và cập nhật giá vé từ 200.000 -> 210.000 | Đọc lại dữ liệu đúng. Đối chiếu: MySQL chạy lệnh `UPDATE`; Redis phải cập nhật Hash và các Set index liên quan | F01, F02; BR-06 |
| TC-S05 | Đọc chi tiết sự kiện 101 kèm danh sách buổi/loại vé; lọc sự kiện theo `city = HCM` | Dữ liệu trả về đầy đủ. Đối chiếu: MySQL dùng `WHERE` và `JOIN`; Redis đọc qua Hash và `SMEMBERS`/`SINTER` | F03; BR-08 |
| TC-S06 | Xóa sự kiện DRAFT 102 cùng các buổi và loại vé trực thuộc | Xóa sạch sẽ. Đối chiếu: MySQL dùng transaction xóa theo quan hệ cha-con; Redis phải xóa từng Hash và xóa ID trong các Set index | F01, F02; BR-07 |
| TC-S07 | Thử nhập giá vé âm, số lượng bằng 0 hoặc tên chỉ gồm khoảng trắng | Bị chặn và báo lỗi rõ ràng. Đối chiếu: Ràng buộc kiểm tra kiểu dữ liệu/CHECK của MySQL so với validator của ứng dụng | BR-04 |
| TC-S08 | Thêm trùng mã loại vé trong cùng một buổi | Bị chặn. Trong khi cùng mã loại vé đó ở buổi khác thì được chấp nhận (ràng buộc unique phạm vi buổi) | F02; BR-01 |
| TC-S09 | Lưu và đọc lại dữ liệu tiếng Việt có dấu và trường mô tả mang giá trị `NULL` | Giữ nguyên vẹn ký tự có dấu; giá trị `NULL` được map chính xác, không bị biến thành chuỗi `"null"` | Chuẩn hóa dữ liệu |
| TC-S10 | Ghi dữ liệu mẫu, restart dịch vụ MySQL và Redis, đọc lại đối chứng | Dữ liệu được bảo toàn nguyên vẹn sau khi khởi động lại dịch vụ bình thường | NFR-01, NFR-03 |
| TC-S11 | Thiết lập key có thời hạn (TTL) mô phỏng giữ vé tạm thời trên Redis | Key tự động hết hạn và biến mất sau TTL. Ghi nhận MySQL không hỗ trợ cơ chế TTL native mà phải dùng cột thời gian | BR-11 |
| TC-S12 | Kiểm toán toàn vẹn dữ liệu: kiểm tra tham chiếu mồ côi | Phát hiện các dữ liệu lệch hoặc thiếu liên kết. MySQL ngăn ngừa tốt bằng Foreign Key; Redis cần cơ chế quét kiểm toán | BR-02, NFR-02 |

---

## 5. Nghiệm thu chức năng và tích hợp (Phân công từng thành viên)

Mỗi thành viên tự xây dựng giao diện (UI) demo hoặc màn hình kiểm thử độc lập cho phần việc của mình:

| Mã | Tiêu chí nghiệm thu | Người phụ trách & Nhóm chức năng |
| --- | --- | --- |
| TC-A01 | Màn hình quản lý tạo/sửa sự kiện có kiểm tra hợp lệ; thông báo lỗi 400/404/409 rõ ràng, không làm mất form | Thành viên 1 (F01, F02 - Storage) |
| TC-A02 | Thao tác thêm/sửa/xóa buổi và loại vé chỉ áp dụng cho sự kiện DRAFT; không sửa nhầm buổi khác | Thành viên 1 (F02 - Storage) |
| TC-A03 | Công bố sự kiện: kiểm tra phải có ít nhất một buổi và loại vé hợp lệ; sự kiện PUBLISHED không cho sửa nội dung | Thành viên 1 (F01, F02 - Storage) |
| TC-A04 | Hộp thoại xác nhận xóa nháp; chọn Hủy không phát sinh xóa; xóa thành công toàn bộ danh mục con | Thành viên 1 (F01, F02 - Storage) |
| TC-A05 | Màn hình tìm kiếm: hỗ trợ tìm theo tên, lọc theo địa phương và thời gian; hiển thị danh sách có phân trang | Thành viên 1 (F03 - Storage) |
| TC-I01 | Xác nhận đặt vé với phiếu giữ hợp lệ: sinh đúng một đơn CONFIRMED, đủ mã vé và chuyển phiếu thành CONSUMED | Thành viên 2 (F05 - Transaction) |
| TC-I02 | Đảm bảo tính nguyên vẹn (Atomicity): nếu xảy ra lỗi trong quá trình tạo đơn/vé, toàn bộ thao tác được rollback | Thành viên 2 (F05 - Transaction) |
| TC-I03 | Hủy đơn đặt vé trước giờ bắt đầu buổi tổ chức: đơn chuyển CANCELLED, vé mất hiệu lực, giải phóng tồn vé | Thành viên 2 (F05, F06 - Transaction) |
| TC-I04 | Tranh chấp giữ vé đồng thời: 2 khách cùng yêu cầu giữ số lượng vé vượt quá tồn khả dụng còn lại | Thành viên 3 (F04 - Concurrency) |
| TC-I05 | Xử lý phiếu giữ hết hạn: phiếu ACTIVE quá hạn không được phép xác nhận thành công | Thành viên 3 (F04 - Concurrency) |
| TC-I06 | Màn hình báo cáo thống kê: hiển thị chính xác tổng số vé CONFIRMED, tổng giá trị và các buổi chưa có đơn | Thành viên 3 (F07 - Concurrency) |

---

## 6. Ma trận 8 loại thao tác / truy vấn bắt buộc theo đề bài

Các thao tác/truy vấn phải được gọi từ mã nguồn ứng dụng và có thể demo trực quan trên giao diện hoặc qua REST API:

| Mã | Loại truy vấn | Chức năng ứng dụng tương ứng | Kết quả mong đợi trên dữ liệu mẫu | Thành viên phụ trách |
| --- | --- | --- | --- | --- |
| Q01 | INSERT | F01/F02 tạo sự kiện/buổi/loại vé; F05 tạo đơn và vé | Tạo bản ghi mới hợp lệ, khóa chính tự tăng hoặc UUID | Thành viên 1 (danh mục); Thành viên 2 (đơn/vé) |
| Q02 | DELETE | F01/F02 xóa sự kiện DRAFT 102 và các danh mục con | Xóa an toàn trong transaction, không để lại dữ liệu mồ côi | Thành viên 1 |
| Q03 | UPDATE | F01 sửa thông tin sự kiện; F02 đổi giá/số lượng loại vé | Cập nhật đúng bản ghi mục tiêu, tự cập nhật `updated_at` | Thành viên 1 |
| Q04 | Điều kiện đơn | F03 lọc sự kiện công khai theo `city_code = 'HCM'` | Trả về đúng danh sách các sự kiện tại TP.HCM | Thành viên 1 |
| Q05 | Điều kiện kết hợp | F03 lọc sự kiện theo thành phố VÀ khoảng thời gian tổ chức | Kết hợp toán tử `AND` chính xác trên cùng một buổi | Thành viên 1 |
| Q06 | JOIN | F06 tra cứu chi tiết đơn hàng (nối bảng `bookings`, `booking_items`, `ticket_types`, `event_showings`) | Trả về thông tin đầy đủ của đơn hàng kèm danh sách mã vé | Thành viên 2 |
| Q07 | Subquery | F07 lọc danh sách các buổi chưa từng có đơn xác nhận (sử dụng truy vấn con `NOT EXISTS`) | Liệt kê chính xác các buổi chưa có đơn hàng CONFIRMED | Thành viên 3 |
| Q08 | Aggregate | F07 thống kê `COUNT(tickets)` và `SUM(price)` theo từng sự kiện/buổi (chỉ tính đơn CONFIRMED) | Tính đúng tổng số vé và tổng tiền, không bị cộng lặp do JOIN | Thành viên 3 |

---

## 7. Mẫu ghi nhận bằng chứng thực nghiệm

Mỗi thành viên khi chạy thực nghiệm cần lưu lại bằng chứng (log hoặc ảnh chụp màn hình UI demo):

| Mã ca kiểm thử | DBMS | Kết quả mong đợi | Kết quả thực tế | Đánh giá | Ghi chú & Liên kết bằng chứng |
| --- | --- | --- | --- | --- | --- |
| TC-S01 | MySQL | Thêm thành công bản ghi sự kiện, buổi, loại vé | Đúng như mong đợi | PASS | Thư mục `experiments/storage/` |
| TC-S01 | Redis | Lưu trữ thành công các Hash và cập nhật Set index | Đúng như mong đợi | PASS | Thư mục `experiments/storage/` |
| TC-S10 | MySQL | Dữ liệu bảo toàn nguyên vẹn sau khi restart service | Dữ liệu còn nguyên | PASS | Log kiểm tra restart |
| TC-S10 | Redis | Dữ liệu bảo toàn với cấu hình persistence (RDB/AOF) | Dữ liệu còn nguyên | PASS | Log kiểm tra restart |

---

## 8. Kịch bản trình bày demo nhóm

Thời lượng đề xuất: 10 - 15 phút cho cả nhóm trong buổi bảo vệ:

1. **Tổng quan đồ án (1 - 2 phút - Chung cả nhóm):**
   - Mở trang chủ web tĩnh giới thiệu Đồ án môn Cơ sở dữ liệu (DBMS).
   - Giới thiệu đề tài EventBox, kiến trúc hệ thống và 3 chủ đề nghiên cứu.
2. **Phần 1: Data Storage & Management (3 - 4 phút - Thành viên 1):**
   - Demo giao diện quản trị danh mục: tạo, sửa, công bố sự kiện và loại vé.
   - Trình bày kết quả so sánh cấu trúc lưu trữ và các ràng buộc giữa MySQL và Redis.
3. **Phần 2: Transaction (3 - 4 phút - Thành viên 2):**
   - Demo giao diện xác nhận đặt vé sinh đơn/mã vé và chức năng hủy đơn vé.
   - Phân tích cơ chế ACID của MySQL trong việc phòng chống lỗi và bảo toàn dữ liệu khi hủy đơn.
4. **Phần 3: Concurrency (3 - 4 phút - Thành viên 3):**
   - Demo giữ vé tạm thời và thử nghiệm tranh chấp đồng thời khi nhiều khách cùng đặt vé giới hạn.
   - Demo màn hình báo cáo thống kê (minh họa truy vấn Subquery và Aggregate).
5. **Tổng kết & Hỏi đáp (2 phút):**
   - Đưa ra bảng đối chiếu tổng hợp và kết luận vai trò của hai DBMS trong thực tế.

---

## 9. Tiêu chuẩn nghiệm thu trước khi nộp bài

- [ ] Toàn bộ 8 loại thao tác/truy vấn (Q01 - Q08) đều được gọi từ mã nguồn và có thể trình diễn trực quan.
- [ ] Cả 3 chủ đề (Storage, Transaction, Concurrency) đều có đầy đủ kịch bản demo, bảng đối chiếu và kết luận thực nghiệm.
- [ ] Giao diện trang chủ web tĩnh giới thiệu đồ án hoạt động tốt; giao diện UI demo của từng thành viên chạy trơn tru với backend.
- [ ] Không xảy ra hiện tượng bán vượt số lượng vé hoặc tạo đơn trùng lặp.
- [ ] Báo cáo nộp bài (PDF), mã nguồn, hướng dẫn cài đặt và bảng phân công đóng góp được đóng gói đầy đủ theo quy định của môn học.
