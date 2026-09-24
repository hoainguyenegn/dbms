# Phạm vi sản phẩm

Mã tài liệu: ETS-SCOPE | Phiên bản: 1.0 | Ngày: 2026-09-21

## 1. Mục tiêu

Hệ thống cho phép người quản lý công bố sự kiện, thiết lập các buổi tổ chức và phân phối vé theo loại. Khách hàng tìm sự kiện, chọn buổi, giữ số lượng vé trong thời gian giới hạn và xác nhận đặt vé.

Ba mục tiêu nghiệp vụ:

1. Thông tin sự kiện, lịch tổ chức và loại vé được quản lý nhất quán.
2. Số lượng được giữ và xác nhận không vượt số lượng phát hành.
3. Đơn hàng và vé có lịch sử tra cứu, các thao tác hết hạn, hủy và gửi lại yêu cầu không làm sai tồn vé.

Sản phẩm tham chiếu trải nghiệm đặt vé sự kiện của Ticketbox. Phạm vi không bao gồm sao chép thương hiệu, tích hợp nền tảng Ticketbox hoặc áp dụng nguyên trạng chính sách thương mại của bên thứ ba.

## 2. Đối tượng sử dụng

| Tác nhân | Trách nhiệm và nhu cầu |
| --- | --- |
| Khách hàng | Tìm sự kiện, chọn buổi/loại vé, giữ vé, xác nhận đặt, xem đơn và hủy đơn của mình |
| Người quản lý | Quản lý danh mục sự kiện/buổi/loại vé, công bố/đóng bán, theo dõi số vé xác nhận và giá trị đơn |
| Nhóm thực hiện | Phát triển, kiểm thử, nghiên cứu và so sánh ba chủ đề trên MySQL và Redis |

Phiên bản 1.0 chạy trong môi trường trình diễn local với khách hàng mẫu và khu vực quản lý nội bộ. Danh tính được mô phỏng qua phiên demo do backend quản lý. Không triển khai đăng ký, mật khẩu, khôi phục tài khoản hoặc phân quyền production. Việc đổi khách mẫu phục vụ kiểm thử, không được trình bày như một cơ chế xác thực an toàn.

Các API tra cứu, xác nhận và hủy vẫn phải kiểm tra chủ sở hữu theo phiên demo; không tin customer_id do client tự gửi trong request nghiệp vụ. Việc triển khai cho người dùng thật phải bổ sung xác thực và kiểm soát quyền trước khi mở truy cập.

## 3. Phạm vi chức năng

| Mã | Nhóm chức năng | Kết quả cần cung cấp |
| --- | --- | --- |
| F01 | Quản lý sự kiện | Danh mục sự kiện, nội dung, thể loại và vòng đời công bố/đóng bán |
| F02 | Quản lý buổi tổ chức và loại vé | Địa điểm, lịch tổ chức/lịch bán, loại vé, giá và số lượng phát hành |
| F03 | Tìm kiếm và xem sự kiện | Danh sách có bộ lọc, phân trang, chi tiết buổi và tình trạng bán vé |
| F04 | Giữ vé tạm thời | Phiếu giữ có chủ sở hữu, số lượng, giá và thời điểm hết hạn |
| F05 | Xác nhận và hủy đặt vé | Đơn nhất quán, xử lý gửi lại, giải phóng tồn vé khi hủy hợp lệ |
| F06 | Tra cứu đơn và vé | Lịch sử đơn, giá chốt, mã vé và tình trạng hiệu lực |
| F07 | Thống kê | Số vé đã xác nhận, tổng giá trị đơn và các buổi chưa có đơn xác nhận |

Mỗi sự kiện có thể có nhiều buổi. Vé được bán theo loại và số lượng; không gắn ghế đánh số. Một đơn chỉ thuộc một buổi tổ chức.

## 4. Luồng nghiệp vụ chính

Tìm sự kiện -> xem chi tiết -> chọn buổi -> chọn loại vé và số lượng -> giữ vé -> kiểm tra thông tin đặt -> xác nhận -> nhận mã đơn và mã vé.

Khách có thể bỏ phiếu giữ trước khi xác nhận. Phiếu giữ tự mất hiệu lực khi hết thời gian. Sau xác nhận, khách được hủy toàn bộ đơn trước giờ bắt đầu buổi tổ chức.

Việc xác nhận trong phiên bản 1.0 không phát sinh giao dịch tài chính. Giao diện sử dụng “Đặt vé thành công” và “Giá trị đơn”, không sử dụng “Đã thanh toán” hoặc “Doanh thu đã thu”.

## 5. Tham số và giới hạn phiên bản

| Nội dung | Quy định |
| --- | --- |
| Thời gian giữ | Tối đa 300 giây, không vượt thời điểm ngừng bán của buổi |
| Số vé mỗi phiếu giữ/đơn | Từ 1 đến 6, tính tổng tất cả loại vé |
| Phạm vi đơn | Một khách, một buổi, một hoặc nhiều loại vé |
| Hủy đơn | Toàn bộ đơn, trước giờ bắt đầu; không hủy từng vé |
| Giá tiền | VND nguyên, từ 0 đến 1.000.000.000 cho một vé |
| Cấu hình sự kiện | Chỉ sửa nội dung, buổi, giá và số lượng khi còn DRAFT |
| Lưu lịch sử | Không xóa phiếu giữ, đơn hoặc vé đã phát sinh để thay cho thao tác đổi trạng thái |

Các tham số trên là quy định của phiên bản 1.0, không phải chính sách của Ticketbox.

## 6. Ngoài phạm vi

- Thanh toán hoặc hoàn tiền thật; hóa đơn tài chính.
- Sơ đồ ghế, hủy từng vé, chuyển nhượng hoặc bán lại vé.
- QR check-in, email/SMS tự động.
- Voucher, khuyến mãi, chương trình thành viên.
- Nhiều nhà tổ chức tự đăng ký, xét duyệt và đối soát.
- Hàng chờ phân tán, Redis Cluster, failover và triển khai production.

Lỗi giữa các bước đặt vé, tranh chấp tồn vé, gửi lại yêu cầu và Redis gián đoạn vẫn thuộc phạm vi kiểm thử. Đây là các điều kiện trực tiếp ảnh hưởng tính đúng đắn của dữ liệu, không phải tính năng mở rộng.

## 7. Kiến trúc và trách nhiệm dữ liệu

Node.js (Express) cung cấp hệ thống REST API và xử lý các quy tắc kiểm tra nghiệp vụ. Giao diện chính của dự án là trang web tĩnh đơn giản giới thiệu Đồ án môn Cơ sở dữ liệu (DBMS). Phần giao diện (UI) phục vụ thao tác nghiệp vụ và thực nghiệm demo do từng thành viên tự thiết kế, xây dựng độc lập theo phân công.

MySQL 8.x đóng vai trò cơ sở dữ liệu chính, lưu trữ danh mục sự kiện, buổi tổ chức, loại vé, phiếu giữ, đơn hàng và vé. Redis 7.x cung cấp bản đọc nhanh của phiếu giữ và quản lý thời hạn (TTL); dữ liệu này có thể tái tạo hoàn toàn từ MySQL khi cần thiết.

Phiếu giữ và tồn vé không phụ thuộc duy nhất vào việc một key Redis còn tồn tại. Khi Redis không sẵn sàng, backend đối chiếu trực tiếp với MySQL; không tạo phiếu giữ hoặc đơn hàng chỉ tồn tại trong Redis. Cách phân định này tránh tình trạng hai nguồn cùng quyết định một số lượng vé.

Ngoài ứng dụng tích hợp, mỗi chủ đề có bộ thực nghiệm độc lập trên MySQL và Redis. Trong thực nghiệm Redis, dữ liệu được lưu và thao tác trực tiếp trên Redis, không gọi MySQL thay cho phần cần so sánh. Môi trường database chạy cục bộ (local); cấu hình và dữ liệu lab tách biệt khỏi dữ liệu ứng dụng.

## 8. Phân công

| Phần việc | Chủ trì | Phối hợp |
| --- | --- | --- |
| F01, F02, F03; mô hình dữ liệu chung; thực nghiệm Storage | Thành viên 1 - Data Storage & Management | Hai thành viên còn lại rà soát dữ liệu phục vụ giữ/đặt/hủy |
| F05, F06; thực nghiệm Transaction | Thành viên 2 - Transaction | Thành viên 3 tích hợp chuyển phiếu giữ thành đơn |
| F04, F07; thực nghiệm Concurrency | Thành viên 3 - Concurrency | Thành viên 2 xử lý các chuyển trạng thái có tranh chấp |
| Kiểm thử tích hợp, báo cáo chung, demo cuối | Cả nhóm | Mỗi người chịu trách nhiệm bằng chứng và UI demo phần mình |

Mỗi thành viên tự triển khai API, phần UI demo riêng, kiểm thử và tài liệu trong phạm vi được giao. Migration và hợp đồng API dùng chung phải được rà soát trước khi tích hợp.

## 9. Điều kiện hoàn thành

- Bảy nhóm chức năng đáp ứng tiêu chí nghiệm thu.
- Tám loại thao tác/truy vấn có chức năng ứng dụng tương ứng.
- Storage, Transaction và Concurrency đều có demo trên hai DBMS, bảng kết quả và kết luận.
- Không bán vượt số lượng; không tạo đơn trùng khi gửi lại; không hoàn tồn hai lần.
- Thành viên khác chạy được dự án và các demo bằng tài liệu bàn giao.
- Báo cáo PDF, source, hướng dẫn, bằng chứng và phân công được đóng gói để nộp theo đề.

Việc hoàn thành được xác nhận bằng kết quả kiểm thử, không bằng số lượng bảng, endpoint hoặc màn hình đã tạo.
