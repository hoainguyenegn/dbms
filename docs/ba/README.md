# Đặc tả nghiệp vụ hệ thống đặt vé sự kiện

| Thuộc tính | Nội dung |
| --- | --- |
| Mã tài liệu | ETS-BA |
| Phiên bản | 1.0 |
| Ngày phát hành | 2026-09-21 |
| Phạm vi | Đồ án DBMS, nhóm 3 thành viên |
| Trạng thái | Đặc tả làm cơ sở thiết kế, phát triển và nghiệm thu |

## 1. Mục đích

Bộ tài liệu xác định yêu cầu của hệ thống đặt vé sự kiện theo buổi tổ chức, loại vé và số lượng. Hệ thống phục vụ hai nhóm sử dụng: khách đặt vé và người quản lý sự kiện.

Phiên bản 1.0 thay thế các bản 0.x theo mô hình ghế đánh số. Các mã chức năng, quy tắc và kiểm thử trong phiên bản này là căn cứ thống nhất khi triển khai. Tài liệu không xác nhận tính năng đã được lập trình hoặc kiểm thử thành công.

## 2. Danh mục tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [Phạm vi sản phẩm](00-product-scope.md) | Mục tiêu, đối tượng sử dụng, giới hạn phiên bản và phân công |
| [Yêu cầu nghiệp vụ](01-requirements.md) | Quy tắc, luồng xử lý, chức năng, giao diện và tiêu chí nghiệm thu |
| [Đặc tả dữ liệu](02-data-model.md) | Mô hình logic, từ điển dữ liệu, tính toàn vẹn và trách nhiệm MySQL/Redis |
| [Kế hoạch kiểm thử và thực nghiệm](03-demo-acceptance.md) | Dữ liệu mẫu, kiểm thử chức năng, nghiên cứu hai DBMS và đối chiếu đề bài |

Yêu cầu nghiệp vụ quy định hành vi hệ thống. Đặc tả dữ liệu quy định thông tin phải được lưu và các điều kiện toàn vẹn. Kế hoạch kiểm thử quy định bằng chứng cần có trước nghiệm thu. Trường hợp phát hiện mâu thuẫn, phải cập nhật đồng bộ các tài liệu trước khi phát hành thay đổi.

## 3. Quy ước

- Fxx: nhóm chức năng.
- BR-xx: quy tắc nghiệp vụ.
- AC-xx: tiêu chí nghiệm thu.
- NFR-xx: yêu cầu chất lượng.
- TC-xx: ca kiểm thử chức năng hoặc tích hợp.
- DMS-xx, TRX-xx, CC-xx: thực nghiệm Storage, Transaction, Concurrency.
- Qxx: loại thao tác/truy vấn bắt buộc trong đề bài.

Tên trạng thái và tên trường kỹ thuật dùng tiếng Anh thống nhất. Giao diện chính của dự án là trang web tĩnh giới thiệu Đồ án môn Cơ sở dữ liệu (DBMS). Các giao diện/màn hình chức năng phục vụ demo do từng thành viên tự xây dựng độc lập theo phân công. Thời gian trao đổi và lưu trữ dùng chuẩn UTC; giao diện hiển thị giờ địa phương theo Asia/Ho_Chi_Minh.

## 4. Quản lý thay đổi

Thay đổi liên quan phạm vi, trạng thái, giá, tồn vé, giữ vé hoặc hủy đơn phải ghi rõ lý do, mã yêu cầu bị ảnh hưởng, tác động dữ liệu và ca kiểm thử cần cập nhật. Không thay đổi ý nghĩa trường hoặc trạng thái chỉ trong mã nguồn.

| Phiên bản | Nội dung |
| --- | --- |
| 0.x | Phân tích ban đầu; phương án ghế đánh số và chuyển hướng sang loại vé/số lượng |
| 1.0 | Thống nhất phạm vi, quy tắc, mô hình dữ liệu và nghiệm thu theo buổi tổ chức/loại vé/số lượng |

## 5. Căn cứ

[Đề bài Assignment_HK261_A01.pdf](../Assignment_HK261_A01.pdf), mục 1.2, 1.3, 2, 3 và 4. Trọng số đánh giá: demonstration 30%, application 30%, cấu trúc báo cáo 10%, nội dung báo cáo 10%, thuyết trình 10%, teamwork 10%.

Bộ BA là đầu vào cho báo cáo kỹ thuật. Báo cáo nộp cuối phải có kết quả thực nghiệm, tài liệu tham khảo, đóng góp từng thành viên và biên bản họp thực tế, không thay kết quả bằng tiêu chí mong đợi.
