# Yêu cầu Đồ án DBMS HK261

Tóm tắt checklist từ [`docs/Assignment_HK261_A01.pdf`](docs/Assignment_HK261_A01.pdf). File này ghi yêu cầu của đề; các mô tả F01–F08 trong README là phạm vi nghiệp vụ nhóm chọn để đáp ứng đề.

## 1. Mục tiêu

- Chọn một miền ứng dụng có nghiệp vụ và dữ liệu đủ đa dạng để xây dựng ứng dụng.
- Thực hành các chức năng chính của **hai DBMS thuộc hai hướng SQL và NoSQL**, sau đó chọn DBMS phù hợp cho bối cảnh ứng dụng.
- Phát triển ứng dụng trên ít nhất một trong hai DBMS đã chọn.
- Báo cáo kiến trúc ứng dụng và công nghệ sử dụng. Đề gợi ý client-server, N-tier, MVC hoặc service-oriented; nhóm tự chọn kiến trúc và công nghệ. Ứng dụng web được kỳ vọng.

## 2. Chủ đề DBMS

Đề đưa ra 5 chủ đề:

1. Data storage & management
2. Indexing
3. Query processing
4. Transaction
5. Concurrency control

Mỗi thành viên phải nghiên cứu ít nhất một chủ đề trên **cả hai DBMS**, so sánh kết quả và kết luận DBMS nào phù hợp hơn cho bối cảnh đã chọn. Số chủ đề chính cần trình bày bằng số thành viên trong nhóm. Có thể nghiên cứu thêm chủ đề để nhận bonus. Nếu tái sử dụng tài liệu từ nguồn khác, phải ghi nguồn và trích dẫn trong báo cáo.

## 3. Yêu cầu ứng dụng

### Chức năng

Ứng dụng phải hỗ trợ tối thiểu:

```text
n >= 2 x số thành viên
```

Đăng nhập/đăng xuất không được tính vào số chức năng nghiệp vụ tối thiểu. Ví dụ, nhóm 3 thành viên cần ít nhất 6 chức năng nghiệp vụ; nhóm 4 thành viên cần ít nhất 8.

### Dữ liệu và query/update

Cấu trúc dữ liệu do sinh viên lựa chọn theo miền ứng dụng, nhưng ứng dụng cần hỗ trợ đủ 8 loại thao tác/truy vấn:

1. Insert
2. Delete
3. Update
4. Query với một điều kiện
5. Query với điều kiện kết hợp
6. Query có join
7. Query có subquery
8. Query dùng aggregate functions

Các thao tác/truy vấn phải phù hợp với dữ liệu và nghiệp vụ đã chọn, có thể chạy và dùng làm minh chứng trong phần demo/báo cáo.

### Hướng dẫn thực hiện trong phạm vi F04–F06

Phạm vi code đang làm là giữ vé, xác nhận/hủy đơn và lịch sử đơn. Theo phân công nhóm trong README, **chủ đề chính thức của Thành viên 2 là Transaction cho F05–F06**; F04 thuộc Concurrency của Thành viên 3. Nếu Thành viên 2 hỗ trợ F04, cần thống nhất với nhóm ai chịu trách nhiệm trình bày chủ đề Concurrency để không bỏ sót hoặc tính trùng chủ đề.

#### A. Thực nghiệm Transaction trên MySQL và Redis

1. Dùng MySQL/InnoDB làm ca transaction nghiệp vụ: xác nhận một reservation phải cùng ghi `bookings`, `booking_items`, `tickets` và đổi reservation sang `CONSUMED`.
2. Chạy các ca cùng một fixture: xác nhận thành công; lỗi giả lập sau khi đã ghi một phần; gửi lại cùng reservation; hủy đơn trước giờ diễn; gửi lại yêu cầu hủy. Ghi trạng thái trước/sau của bốn bảng và chứng minh lỗi giữa chừng không để lại bản ghi dở dang.
3. Tạo ca đối chiếu Redis trong namespace/key thử nghiệm riêng, không dùng dữ liệu booking thật: thử thao tác nhiều key và Lua script khi có lỗi. Ghi rõ Redis `MULTI/EXEC` và Lua đảm bảo atomic visibility/không xen kẽ lệnh, nhưng không cung cấp rollback nhiều lệnh như transaction MySQL; thiết kế script phải validate trước khi ghi nếu cần tránh trạng thái một phần.
4. So sánh kết quả: atomicity/rollback, durability sau restart theo cấu hình, khả năng giữ quan hệ và tính phù hợp cho booking history. Kết luận booking/order/ticket cần MySQL transaction; Redis phù hợp làm cache/hold nhanh, không thay nguồn xác nhận đơn.

#### B. Thực nghiệm Concurrency cho F04

1. Chuẩn bị một suất diễn có capacity nhỏ, ví dụ 20 vé, và chạy các request giữ vé đồng thời; mỗi request dùng `request_key` duy nhất. Lặp lại cùng một request để kiểm tra idempotency.
2. So sánh hai cấu hình cô lập: MySQL/InnoDB khóa cùng hàng `event_showings` rồi tính `capacity - sold - active holds`; Redis dùng một Lua script với counter/hold state dùng chung để check-and-reserve nguyên tử. Không dùng cùng một lượt chạy để so sánh vì hệ thống tích hợp có thể dùng cả hai.
3. Ghi số request, số hold thành công, xung đột/hết vé, lỗi, thời gian p50/p95, tồn cuối cùng và số lượng vượt capacity (nếu có). Điều kiện đúng là tổng vé confirmed + active hold không vượt capacity; gửi lại cùng `request_key` không tăng tồn hai lần.
4. Chạy thêm tình huống release, TTL hết hạn, Redis restart/cache mất và MySQL unavailable. Đối chiếu trạng thái cuối với MySQL; Redis cache miss/TTL không tự chứng minh reservation trong MySQL đã hết hạn.

**Giới hạn implementation hiện tại:** F04 đang dùng khóa hàng suất diễn và reservation rows trong MySQL để quyết định tồn; Redis Lua hiện ghi/xóa cache theo từng reservation sau commit, chưa có counter tồn vé dùng chung. Vì vậy test F04 hiện tại chứng minh luồng MySQL, idempotency, rollback và cache; **chưa đủ để tuyên bố đã benchmark hoặc chống oversell bằng Redis độc lập**. Muốn báo cáo so sánh Concurrency giữa hai DBMS, cần bổ sung counter Lua hoặc một benchmark Redis riêng, rồi ghi rõ ranh giới thử nghiệm.

#### C. Ánh xạ 8 dạng query/update vào F04–F06

| Dạng | Ví dụ trong phạm vi | Bằng chứng nên lưu |
| --- | --- | --- |
| Insert | Tạo reservation/items (F04); tạo booking/items/tickets trong transaction (F05). | SQL/API request và số row trước/sau. |
| Delete | Không hard-delete reservation, booking hoặc vé vì phải giữ lịch sử theo BR-19. Phần DELETE của yêu cầu chung nên được minh chứng bằng xóa fixture tạm có kiểm soát hoặc chức năng xóa nháp F01/F02 của thành viên phụ trách; không xóa lịch sử F04–F06 để tạo demo. | Query và kết quả, nêu rõ đây không phải xóa dữ liệu nghiệp vụ lịch sử. |
| Update | Chuyển reservation `ACTIVE` sang `CONSUMED`, `RELEASED`, `EXPIRED`; booking `CONFIRMED` sang `CANCELLED`. | State transition và số row bị ảnh hưởng. |
| Một điều kiện | Đọc booking theo `booking_code` duy nhất hoặc tra reservation theo `id`. | SQL và `EXPLAIN`. |
| Điều kiện kết hợp | Tồn vé theo `ticket_type_id`, booking `CONFIRMED`, reservation `ACTIVE` và `expires_at > now`; hoặc lọc booking theo owner + status. | SQL, kết quả và `EXPLAIN`. |
| Join | F06 nối booking, showing, event, booking items, ticket types và tickets. | Kết quả mẫu, số dòng và `EXPLAIN`. |
| Subquery | Tính `sold` từ booking confirmed và `held` từ reservation active còn hạn khi tính khả dụng. | SQL, kết quả theo từng loại vé và `EXPLAIN`. |
| Aggregate | `SUM(quantity)`/`SUM(subtotal_vnd)` theo booking hoặc loại vé; đối chiếu ticket count với số mã vé được phát hành. | Giá trị aggregate và phép đối chiếu dữ liệu gốc. |

Để phép demo có thể chạy lại, dùng fixture dành riêng cho F04–F06, ghi lại lệnh reset/nạp fixture và không dùng dữ liệu cá nhân hoặc credential thật. Các query cần chạy trên DBMS tương ứng; Redis command/Lua không được ghi nhận thay cho SQL query của MySQL.

## 4. Làm việc nhóm

- Nhóm thường có 3–4 thành viên; nhóm đặc biệt có thể được chấp nhận theo quyết định của giảng viên.
- Phải báo cáo phần đóng góp của từng thành viên.
- Mỗi thành viên trình bày phần việc của mình trong presentation.

## 5. Kết quả và hồ sơ nộp

- **Demonstration:** Demo hai DBMS và phần so sánh cho các chủ đề được phân công.
- **Application:** Ứng dụng chạy ổn định trên ít nhất một DBMS đã chọn.
- **Technical report:** Báo cáo kỹ thuật định dạng PDF, có nội dung về dự án, kết luận kèm tự đánh giá và tài liệu tham khảo.
- **Presentation:** Tất cả thành viên trình bày phần việc của mình; presentation phải có demo hai DBMS và ứng dụng.
- **Teamwork evidence:** Báo cáo rõ đóng góp từng thành viên; rubric teamwork mức cao yêu cầu đính kèm ít nhất một meeting minute.
- **Submission:** Trưởng nhóm nộp bản mềm lên LMS trong **một file ZIP duy nhất**.
- **Thời hạn theo đề:** Tuần 48, 49 hoặc 50.

## 6. Rubric đánh giá

| Hạng mục | Trọng số | Tiêu chí mức cao theo rubric |
| --- | ---: | --- |
| Cấu trúc báo cáo | 10% | Báo cáo có cấu trúc rõ, các phần được tổ chức phù hợp và có đủ phần cơ bản. |
| Nội dung báo cáo | 10% | Bao phủ trên 90% yêu cầu của đồ án. |
| Presentation | 10% | Demo hai DBMS và ứng dụng được trình bày rõ ràng, tự tin, phù hợp. |
| Teamwork | 10% | Đóng góp từng thành viên được báo cáo chi tiết và có ít nhất một meeting minute đính kèm. |
| Demonstration | 30% | Tất cả chủ đề được demo đúng và đầy đủ. |
| Application | 30% | Hỗ trợ trên 85% yêu cầu chức năng và các loại query/update; ứng dụng chạy đúng, giao diện thân thiện. |

## 7. Bonus

Đề cho bonus từ **1 đến 2 điểm** cho phần làm thêm hoặc kết quả xuất sắc:

- **0.5 điểm:** đóng góp lý thuyết bổ sung/xuất sắc.
- **1 điểm:** đóng góp lý thuyết có ví dụ và so sánh giữa các DBMS.
- **1.5 điểm:** đóng góp lý thuyết được đưa một phần vào ứng dụng.
- **2 điểm:** đóng góp lý thuyết và thực hành được tích hợp đầy đủ vào ứng dụng.

## 8. Checklist hoàn thành

- [x] Chốt miền ứng dụng, hai DBMS SQL/NoSQL, kiến trúc và công nghệ; ghi rõ lý do chọn.
- [x] Đạt tối thiểu `2 x số thành viên` chức năng nghiệp vụ, không tính login/logout.[planned]
- [ ] Phân công đủ số chủ đề DBMS tương ứng số thành viên; mỗi chủ đề có thực nghiệm trên cả hai DBMS, so sánh kết quả và kết luận.
- [ ] Có dữ liệu phù hợp và minh chứng chạy đủ 8 dạng query/update.
- [ ] Ứng dụng chạy ổn định trên ít nhất một DBMS.
- [ ] Hoàn thành technical report PDF, references/citations và self-assessment.
- [ ] Có báo cáo đóng góp từng thành viên và meeting minute.
- [ ] Chuẩn bị presentation: mỗi thành viên trình bày phần mình, demo hai DBMS và ứng dụng.
- [ ] Đóng gói toàn bộ nội dung cần nộp thành một ZIP và nộp lên LMS đúng tuần được thông báo.
