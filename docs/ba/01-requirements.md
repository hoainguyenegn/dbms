# Đặc tả yêu cầu nghiệp vụ

Mã tài liệu: ETS-BR | Phiên bản: 1.0 | Ngày: 2026-09-21

## 1. Thuật ngữ

| Thuật ngữ | Định nghĩa |
| --- | --- |
| Sự kiện | Nội dung chương trình được công bố, gồm tên, mô tả và thể loại |
| Buổi tổ chức | Một lần diễn ra của sự kiện tại địa điểm và thời gian xác định |
| Loại vé | Một nhóm vé của một buổi, có mã, tên, giá và số lượng phát hành |
| Phiếu giữ | Cam kết tạm giữ số lượng vé cho một khách đến thời điểm hết hạn |
| Đơn đặt vé | Kết quả xác nhận thành công một phiếu giữ |
| Vé | Một đơn vị được phát hành trong đơn, có mã tra cứu riêng |
| Tồn khả dụng | Số lượng còn được phép giữ sau khi trừ vé xác nhận và phiếu giữ còn hiệu lực |

## 2. Quy tắc nghiệp vụ

### 2.1. Danh mục và lịch bán

| Mã | Quy tắc |
| --- | --- |
| BR-01 | Mã sự kiện duy nhất toàn hệ thống. Mã buổi duy nhất trong sự kiện. Mã loại vé duy nhất trong buổi. Mã được trim, chuyển uppercase và không đổi sau tạo. |
| BR-02 | Một buổi thuộc đúng một sự kiện; một loại vé thuộc đúng một buổi. Không chuyển đối tượng sang cha khác sau tạo. |
| BR-03 | Thời gian bắt đầu bán < thời gian ngừng bán <= thời gian bắt đầu buổi < thời gian kết thúc buổi. Backend kiểm tra UTC; không dựa vào đồng hồ trình duyệt. |
| BR-04 | Giá vé là số nguyên VND, 0..1.000.000.000. Số lượng phát hành là số nguyên 1..100.000 cho mỗi loại vé. |
| BR-05 | Sự kiện chuyển DRAFT -> PUBLISHED -> CLOSED, không mở lại. Khi công bố, phải có ít nhất một buổi; mỗi buổi có ít nhất một loại vé, lịch hợp lệ và thời điểm ngừng bán ở tương lai. |
| BR-06 | Chỉ sửa nội dung, thể loại, địa điểm, lịch, loại vé, giá và số lượng khi sự kiện DRAFT. Sau công bố chỉ cho phép đóng bán. |
| BR-07 | Chỉ xóa cứng dữ liệu thuộc sự kiện DRAFT và không có phiếu giữ, đơn hoặc vé phụ thuộc. Xóa sự kiện/buổi phải xóa các danh mục con cùng một đơn vị công việc; lỗi không để dữ liệu dở dang. |
| BR-08 | Chỉ nhận giữ và xác nhận khi sự kiện PUBLISHED và buổi đang trong khoảng [bắt đầu bán, ngừng bán). Đóng sự kiện chặn giữ/xác nhận mới và giải phóng các phiếu giữ ACTIVE chưa dùng; không hủy đơn đã xác nhận. |

Danh sách khách hiển thị sự kiện PUBLISHED có ít nhất một buổi chưa bắt đầu. Buổi chưa mở bán hoặc đã ngừng bán vẫn có thể được xem với nhãn tương ứng; nút giữ vé chỉ bật khi BR-08 thỏa mãn. DRAFT và CLOSED không xuất hiện trong danh mục công khai. Đơn cũ vẫn hiển thị thông tin lịch sử khi sự kiện CLOSED.

### 2.2. Giữ và xác nhận vé

| Mã | Quy tắc |
| --- | --- |
| BR-09 | Một phiếu giữ thuộc một khách và một buổi; chứa từ 1 đến 6 vé, tính tổng các dòng. Mỗi loại vé xuất hiện tối đa một dòng; số lượng mỗi dòng là số nguyên dương. |
| BR-10 | Một khách có tối đa một phiếu giữ còn hiệu lực cho một buổi. Muốn đổi lựa chọn phải giải phóng phiếu cũ và tạo phiếu mới. Không gia hạn tự động. |
| BR-11 | Thời điểm hết hạn = min(thời điểm cấp phiếu + 300 giây, thời điểm ngừng bán). Phiếu mất hiệu lực khi now >= expires_at, kể cả khi tác vụ cập nhật trạng thái chưa chạy. |
| BR-12 | Tổng vé xác nhận và vé đang giữ còn hiệu lực không vượt số lượng phát hành của từng loại. Yêu cầu có nhiều loại vé được chấp nhận toàn bộ hoặc từ chối toàn bộ. |
| BR-13 | Backend xác định giá từ danh mục và lưu vào phiếu giữ. Client không được quyết định giá, tổng tiền, chủ sở hữu hoặc trạng thái. |
| BR-14 | Xác nhận phải đúng chủ sở hữu, phiếu còn hiệu lực và đáp ứng BR-08. Một phiếu chỉ sinh một đơn; tạo đơn, chi tiết, vé và chuyển phiếu thành CONSUMED phải nhất quán. |
| BR-15 | Mỗi dòng đơn lưu loại vé, số lượng và đơn giá đã chốt. Tổng đơn = tổng quantity x unit_price_vnd. Mỗi đơn vị vé có một mã riêng; số mã phải bằng tổng số lượng trong đơn. |
| BR-16 | Tạo phiếu giữ dùng mã yêu cầu chống lặp trong phạm vi khách. Cùng mã và cùng nội dung trả lại phiếu cũ, không tăng tồn giữ hoặc gia hạn; cùng mã nhưng khác nội dung bị từ chối. Xác nhận lại cùng phiếu trả đơn đã có, kể cả khi đơn đã hủy, không tạo đơn mới. |

Thời điểm đánh giá điều kiện xác nhận được lấy ở backend sau khi đã giành quyền xử lý dữ liệu tranh chấp và trước khi chuyển trạng thái trong transaction. Thời điểm client bấm nút hoặc gửi request không quyết định quyền ưu tiên. Sau khi giao dịch xác nhận được ghi nhận thành công, tác vụ hết hạn không được giải phóng lại số lượng đó.

### 2.3. Hủy, lịch sử và đối chiếu

| Mã | Quy tắc |
| --- | --- |
| BR-17 | Khách được hủy toàn bộ đơn CONFIRMED của mình khi now < giờ bắt đầu buổi. Không hủy từng vé; không có nghiệp vụ hoàn tiền trong phiên bản 1.0. |
| BR-18 | Hủy chuyển đơn thành CANCELLED; vé trong đơn mất hiệu lực và số lượng không còn tính vào vé xác nhận. Hủy lại trả trạng thái hiện tại, không hoàn tồn thêm và không đổi thời điểm hủy lần đầu. |
| BR-19 | Phiếu giữ, đơn, chi tiết và mã vé không bị xóa sau khi hết hạn/hủy. CONSUMED không quay lại ACTIVE khi đơn bị hủy. |
| BR-20 | Số vé xác nhận tính theo tổng số lượng dòng đơn CONFIRMED. Giá trị xác nhận tính theo giá chốt; loại đơn CANCELLED, phiếu giữ và vé hết hạn khỏi chỉ tiêu này. |
| BR-21 | MySQL là nguồn xác nhận danh mục, phiếu giữ, đơn và vé. Redis lưu bản đọc nhanh của phiếu giữ; key thiếu, lỗi hoặc hết TTL không tự chứng minh phiếu đã hết hạn hoặc vé đã được trả. |
| BR-22 | Mọi thao tác trên phiếu giữ/đơn/vé phải kiểm tra chủ sở hữu theo phiên demo tại backend. Người quản lý dùng ngữ cảnh riêng; không lấy quyền thao tác từ trường role hoặc customer_id trong payload nghiệp vụ. |

## 3. Vòng đời

| Đối tượng | Trạng thái | Ý nghĩa / chuyển tiếp |
| --- | --- | --- |
| Sự kiện | DRAFT | Đang chuẩn bị; được sửa/xóa; chuyển PUBLISHED khi đủ điều kiện |
| Sự kiện | PUBLISHED | Công khai; từng buổi bán theo lịch; có thể chuyển CLOSED |
| Sự kiện | CLOSED | Ngừng bán toàn sự kiện; không mở lại |
| Phiếu giữ | ACTIVE | Còn chờ xác nhận; chỉ giữ tồn khi now < expires_at |
| Phiếu giữ | CONSUMED | Đã chuyển thành một đơn; trạng thái kết thúc |
| Phiếu giữ | RELEASED | Khách bỏ giữ hoặc người quản lý đóng sự kiện; trạng thái kết thúc |
| Phiếu giữ | EXPIRED | Hết thời hạn chưa xác nhận; trạng thái kết thúc |
| Đơn | CONFIRMED | Đặt thành công; vé có hiệu lực |
| Đơn | CANCELLED | Đã hủy; vé không còn hiệu lực |

Vé lấy tình trạng hiệu lực từ đơn, không có trạng thái thanh toán hoặc check-in riêng. Buổi tổ chức không cần cột trạng thái trùng với sự kiện và lịch bán; nhãn Chưa mở bán/Đang bán/Ngừng bán/Đã bắt đầu được suy ra.

## 4. Yêu cầu chức năng và tiêu chí nghiệm thu

### F01. Quản lý sự kiện

Người quản lý tạo sự kiện nháp, cập nhật nội dung, công bố và đóng bán.

- AC-01.1: Tạo hợp lệ sinh một sự kiện DRAFT. Mã trùng sau chuẩn hóa bị từ chối, không ghi đè sự kiện cũ.
- AC-01.2: Sửa chỉ áp dụng cho DRAFT. Nội dung sai hoặc có trường không được sửa bị từ chối toàn bộ.
- AC-01.3: Công bố kiểm tra tất cả buổi/loại vé theo BR-05; không công bố một phần.
- AC-01.4: Xóa nháp có xác nhận trên giao diện, nêu tên/mã và số danh mục con sẽ xóa. Hủy hộp thoại không phát sinh yêu cầu xóa.
- AC-01.5: Đóng sự kiện chặn giữ/xác nhận mới, giải phóng phiếu ACTIVE chưa dùng và giữ nguyên đơn CONFIRMED. Nếu có tranh chấp với xác nhận, kết quả phải tương ứng một thứ tự xử lý hợp lệ.

### F02. Quản lý buổi tổ chức và loại vé

Người quản lý thiết lập lịch, địa điểm và cơ cấu vé trong sự kiện nháp.

- AC-02.1: Tạo/sửa/xóa buổi và loại vé tuân thủ quan hệ cha, phạm vi DRAFT và điều kiện thời gian/giá/số lượng.
- AC-02.2: Mã loại vé trùng trong cùng buổi bị chặn; cùng mã ở buổi khác được phép.
- AC-02.3: Cập nhật hoặc xóa loại vé bằng URL thuộc buổi khác không được tác động dữ liệu.
- AC-02.4: Một buổi thiếu loại vé hoặc có lịch bán không hợp lệ không được công bố cùng sự kiện.
- AC-02.5: Khi một bước xóa danh mục con thất bại, dữ liệu trước thao tác được giữ nguyên.

### F03. Tìm kiếm và xem sự kiện

Khách tìm theo tên, thể loại, địa phương và ngày tổ chức; xem buổi, loại vé, giá và tình trạng bán.

- AC-03.1: Danh sách khách tuân thủ điều kiện công khai ở mục 2.1; truy cập trực tiếp DRAFT/CLOSED trả không tìm thấy.
- AC-03.2: Các bộ lọc được kết hợp bằng AND. Điều kiện địa phương và thời gian phải cùng thỏa trên ít nhất một buổi, không ghép địa phương của buổi này với ngày của buổi khác.
- AC-03.3: Khoảng ngày theo [from, to), chuyển đúng từ Asia/Ho_Chi_Minh sang UTC. Mỗi sự kiện chỉ xuất hiện một lần dù nhiều buổi phù hợp.
- AC-03.4: Sắp xếp theo thời gian buổi phù hợp sớm nhất, sau đó event_id; phân trang sau khi loại trùng. page bắt đầu 1, page_size mặc định 20, tối đa 100; total là số sự kiện sau lọc.
- AC-03.5: Không có kết quả trả danh sách rỗng; lỗi dịch vụ có thông báo và thao tác thử lại, không hiển thị như danh mục rỗng.
- AC-03.6: Màn chi tiết phân biệt giá vé, số lượng khả dụng và tình trạng mở bán. Số lượng trên màn hình chỉ là thông tin tại lúc đọc; việc giữ phải được backend kiểm tra lại.

### F04. Giữ vé tạm thời

Khách gửi lựa chọn loại vé/số lượng và nhận một phiếu giữ có thời hạn.

- AC-04.1: Nếu mọi dòng đủ tồn, cấp một phiếu và trả thời điểm hết hạn, giá chốt, tổng số vé và tổng giá trị.
- AC-04.2: Nếu một dòng thiếu tồn, sai buổi, sai số lượng hoặc vượt 6 vé, từ chối toàn bộ; không giữ các dòng còn lại.
- AC-04.3: Cùng mã yêu cầu được gửi lại trả phiếu cũ; payload khác với mã đã dùng trả lỗi xung đột.
- AC-04.4: Bỏ giữ hoặc hết hạn làm số lượng đó khả dụng cho khách khác đúng một lần; không xóa lịch sử phiếu.
- AC-04.5: Phiếu ACTIVE đã quá hạn không được tính giữ tồn hoặc được xác nhận, dù tiến trình quét chưa cập nhật cột status.
- AC-04.6: Reload không tạo phiếu mới và không làm đồng hồ trở lại 5 phút. Khách không xem hoặc giải phóng được phiếu của khách khác.

### F05. Xác nhận và hủy đặt vé

Khách xác nhận phiếu giữ; hệ thống tạo đơn, chi tiết và mã vé. Khách được hủy đơn theo BR-17.

- AC-05.1: Xác nhận hợp lệ tạo đúng một đơn CONFIRMED, đủ dòng và đủ mã vé; phiếu thành CONSUMED. Không có giai đoạn vừa tính giữ vừa tính đã bán cho cùng số lượng.
- AC-05.2: Lỗi trước khi ghi nhận transaction không để lại đơn, mã vé hoặc chuyển trạng thái phiếu một phần.
- AC-05.3: Mất phản hồi sau khi đã ghi nhận không tạo thêm đơn khi khách thử lại. Backend trả đơn gắn với phiếu đã dùng.
- AC-05.4: Phiếu hết hạn, bị giải phóng, sai chủ sở hữu hoặc buổi ngừng bán không sinh đơn.
- AC-05.5: Hủy hợp lệ giữ lịch sử và làm vé mất hiệu lực. Hủy lặp, hủy đồng thời hoặc xác nhận lại phiếu của đơn đã hủy không tạo thêm tồn hay vé mới.
- AC-05.6: Tại hoặc sau giờ bắt đầu buổi, yêu cầu hủy bị từ chối; dữ liệu không đổi.

### F06. Tra cứu đơn và vé

Khách xem danh sách đơn của mình và chi tiết từng đơn.

- AC-06.1: Hiển thị mã đơn, sự kiện, buổi, địa điểm, loại vé, số lượng, đơn giá chốt, tổng giá trị và trạng thái.
- AC-06.2: Mỗi đơn vị vé có mã riêng, liên kết được về dòng đơn. Vé của đơn hủy vẫn hiển thị với nhãn Không còn hiệu lực.
- AC-06.3: Sự kiện đóng bán không làm mất thông tin lịch sử. Khách khác không truy cập được đơn hoặc mã vé bằng cách thay ID/mã trên URL.
- AC-06.4: Danh sách đơn sắp booked_at giảm dần rồi id giảm dần, có phân trang và trạng thái rỗng.

### F07. Thống kê

Người quản lý xem kết quả theo sự kiện, buổi và loại vé.

- AC-07.1: Hiển thị số vé CONFIRMED và tổng giá trị xác nhận; không tính CANCELLED hoặc phiếu giữ.
- AC-07.2: Bộ lọc thời gian áp dụng vào giờ bắt đầu buổi; thông tin này được ghi rõ trên giao diện.
- AC-07.3: Có bộ lọc “Buổi chưa có đơn xác nhận” sử dụng truy vấn con trong MySQL.
- AC-07.4: Buổi/loại vé chưa phát sinh đơn có số liệu 0, không bị mất khỏi báo cáo khi chọn phạm vi đó.
- AC-07.5: Đơn có nhiều dòng và nhiều mã vé không bị cộng lặp giá trị do JOIN.

## 5. Giao diện và thông tin phản hồi

Giao diện chính của dự án là trang web tĩnh đơn giản giới thiệu Đồ án môn Cơ sở dữ liệu (DBMS). Đối với các chức năng nghiệp vụ, mỗi thành viên tự xây dựng giao diện người dùng (UI) hoặc màn hình demo độc lập phù hợp với phạm vi phân công của mình.

Bảng dưới đây định hướng phạm vi giao diện demo theo từng thành viên:

| Khu vực / Màn hình demo | Nội dung tối thiểu | Phụ trách |
| --- | --- | --- |
| Trang chủ dự án (Web tĩnh) | Giới thiệu đồ án DBMS, tổng quan hệ thống EventBox, thông tin thành viên và phân công chủ đề | Cả nhóm |
| Khám phá & Quản lý sự kiện | Danh sách sự kiện, bộ lọc, chi tiết buổi, loại vé; giao diện quản lý tạo, sửa, xóa nháp và công bố (F01, F02, F03) | Thành viên 1 (Storage) |
| Giữ vé & Thống kê báo cáo | Chọn loại vé, số lượng, tạo phiếu giữ vé tạm thời (F04); màn hình thống kê số vé, giá trị xác nhận, buổi chưa có đơn (F07) | Thành viên 3 (Concurrency) |
| Xác nhận, Hủy & Tra cứu đơn | Xem chi tiết phiếu giữ, xác nhận đặt vé sinh đơn/mã vé (F05); tra cứu lịch sử đơn và thao tác hủy đơn (F06) | Thành viên 2 (Transaction) |

Nguyên tắc phản hồi trên các giao diện demo:
- Nút thao tác không hợp lệ theo trạng thái nghiệp vụ cần được vô hiệu hóa hoặc ẩn (backend vẫn kiểm tra lại độc lập).
- Giao diện giữ lại thông tin form khi yêu cầu thất bại để thuận tiện thao tác lại.
- Thông báo lỗi/kết quả rõ ràng, nêu đúng lý do nghiệp vụ (hết vé khả dụng, chưa mở bán, phiếu quá hạn, xung đột mã yêu cầu, đơn không được phép hủy,...); tuyệt đối không trả lỗi SQL thô, stack trace hoặc thông tin bảo mật ra màn hình.

## 6. Hợp đồng API mức nghiệp vụ

Các endpoint sau thuộc thiết kế phiên bản 1.0; chưa phải danh sách chức năng đã lập trình. Tiền tố /admin không tự cung cấp cơ chế phân quyền.

| Method | Endpoint | Trách nhiệm |
| --- | --- | --- |
| GET/POST | /api/admin/events | Danh sách quản trị/tạo sự kiện |
| GET/PATCH/DELETE | /api/admin/events/:id | Xem/sửa/xóa nháp |
| POST | /api/admin/events/:id/publish | Công bố |
| POST | /api/admin/events/:id/close | Đóng bán và giải phóng phiếu chưa dùng |
| GET/POST | /api/admin/events/:id/showings | Danh sách/tạo buổi |
| PATCH/DELETE | /api/admin/showings/:id | Sửa/xóa buổi nháp |
| GET/POST | /api/admin/showings/:id/ticket-types | Danh sách/tạo loại vé |
| PATCH/DELETE | /api/admin/ticket-types/:id | Sửa/xóa loại vé nháp |
| GET | /api/events | Tìm kiếm công khai |
| GET | /api/events/:id | Chi tiết công khai kèm các buổi |
| GET | /api/showings/:id/ticket-types | Loại vé, giá, lịch bán, số lượng khả dụng |
| POST | /api/reservations | Cấp phiếu giữ với request_key, showing_id và items |
| GET | /api/reservations/:id | Đọc phiếu giữ của phiên hiện tại |
| POST | /api/reservations/:id/release | Bỏ giữ |
| POST | /api/reservations/:id/confirm | Xác nhận hoặc trả đơn đã gắn với phiếu |
| GET | /api/me/bookings | Danh sách đơn của khách trong phiên |
| GET | /api/me/bookings/:code | Chi tiết đơn và các mã vé |
| POST | /api/me/bookings/:code/cancel | Hủy toàn bộ đơn |
| GET | /api/admin/reports/bookings | Báo cáo theo sự kiện/buổi/loại vé |

items gồm ticket_type_id và quantity; không nhận đơn giá hoặc customer_id từ client. Các request ghi từ chối trường không hỗ trợ, PATCH rỗng và mã định danh không hợp lệ. Các endpoint tài nguyên con phải xác minh quan hệ cha khi có cả hai ID.

HTTP: 201 khi tạo mới; 200 khi đọc/cập nhật hoặc trả kết quả của thao tác lặp; 204 khi xóa nháp; 400 khi sai dữ liệu; 404 khi không tìm thấy hoặc tài nguyên không thuộc khách; 409 khi vi phạm trạng thái/tồn vé/chống lặp; 503 khi không thể xác nhận an toàn do dịch vụ chính không sẵn sàng. Ngữ cảnh không được vào khu vực quản lý nhận 403.

## 7. Yêu cầu chất lượng

| Mã | Yêu cầu và cách kiểm tra |
| --- | --- |
| NFR-01 | Tính đúng đắn: không bán vượt, không giữ vượt; các tổng khớp dữ liệu gốc sau thao tác thường và đồng thời |
| NFR-02 | Tính nguyên vẹn: lỗi giữa luồng ghi không để lại trạng thái một phần |
| NFR-03 | Khả năng phục hồi: khi Redis lỗi, đọc/ghi nghiệp vụ vẫn đối chiếu MySQL; không báo thành công nếu MySQL chưa xác nhận; bản Redis cũ không được hồi sinh phiếu đã kết thúc |
| NFR-04 | Quyền sở hữu: mọi endpoint cá nhân kiểm tra phiên tại backend; thử thay ID bằng tài nguyên khách khác phải bị chặn |
| NFR-05 | An toàn dữ liệu: truy vấn tham số hóa; không render mô tả thành HTML không kiểm soát; không dùng PII/credential thật trong seed và bằng chứng |
| NFR-06 | Khả dụng giao diện: Web tĩnh chung hiển thị rõ ràng, súc tích. Giao diện demo của từng thành viên đảm bảo có trạng thái tải (loading), dữ liệu rỗng (empty) và thông báo lỗi (error) phục vụ tốt cho buổi nghiệm thu |
| NFR-07 | Tái lập: cấu hình, fixture, script và phiên bản được ghi nhận; một thành viên khác chạy lại được |
| NFR-08 | Hiệu năng kiểm thử: fixture nghiệp vụ và bài tải 100 request được công bố; ghi số thành công/xung đột/lỗi, độ trễ và trạng thái cuối, không đặt SLA khi chưa đo |
| NFR-09 | Thời gian: mọi quyết định dùng đồng hồ backend; tại thời điểm hết hạn/ngừng bán/bắt đầu áp dụng điều kiện biên như BR-03, BR-08, BR-11 và BR-17 |
| NFR-10 | Vận hành: không dùng cache làm nguồn khẳng định còn vé; không dựa vào sự kiện key hết hạn làm cơ chế duy nhất trả tồn |
