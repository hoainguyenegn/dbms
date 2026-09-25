# Đặc tả nghiệp vụ hệ thống đặt vé sự kiện EventBox

| Thuộc tính | Nội dung |
| --- | --- |
| Mã tài liệu | ETS-BA |
| Phiên bản | 1.1 |
| Ngày phát hành | 2026-09-25 |
| Phạm vi | Đồ án DBMS, nhóm 3 thành viên |
| Kiến trúc | Ứng dụng Web hiện đại (Client-Server / N-tier: React 19 SPA + Express API + MySQL 8.0 + Redis 7.0) |
| Trạng thái | Đặc tả nghiệp vụ chính thức làm cơ sở thiết kế CSDL, phát triển API, giao diện và nghiệm thu |

## 1. Mục đích

Bộ tài liệu xác định yêu cầu nghiệp vụ của hệ thống đặt vé sự kiện **EventBox** theo buổi tổ chức, loại vé và số lượng. 

Khác với các trang web tĩnh thông thường, **EventBox là một ứng dụng web hiện đại (Modern Full-Stack Web Application)** hoạt động tương tác thời gian thực, giao tiếp qua RESTful API, quản lý trạng thái động và lưu trữ dữ liệu bền vững trên hai hệ quản trị CSDL: **MySQL 8.0 (InnoDB)** và **Redis 7.0 (In-memory)**.

Hệ thống hỗ trợ cơ chế xác thực và phân quyền người dùng (Role-Based Access Control - RBAC):
- **`USER` (Khách hàng):** Đăng nhập, tìm kiếm sự kiện, giữ vé tạm thời, xác nhận đơn hàng, nhận email vé điện tử tự động và quản lý lịch sử đơn của mình.
- **`MANAGER` (Quản lý hệ thống):** Đăng nhập, quản lý vòng đời sự kiện, cấu hình buổi tổ chức, loại vé, đóng bán và theo dõi báo cáo thống kê doanh thu/tồn vé.

## 2. Danh mục tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [Phạm vi sản phẩm](00-product-scope.md) | Mục tiêu, đối tượng sử dụng, phân quyền RBAC, phạm vi F01-F08 và phân công |
| [Yêu cầu nghiệp vụ](01-requirements.md) | Quy tắc nghiệp vụ (BR), luồng xử lý, tiêu chí nghiệm thu (AC), giao diện và API skeleton |
| [Đặc tả dữ liệu](02-data-model.md) | Mô hình thực thể (ERD), từ điển dữ liệu (`users`, `events`, `bookings`...), tính toàn vẹn và cơ chế gửi email |
| [Kế hoạch kiểm thử và thực nghiệm](03-demo-acceptance.md) | Dữ liệu mẫu (fixture), kịch bản kiểm thử chức năng, thực nghiệm DBMS và đối chiếu đề bài |
| [Thiết kế & Mô tả CSDL](../database-design.md) | **Tài liệu Thiết kế & Mô tả CSDL chi tiết**: Chuẩn hóa 3NF/BCNF, từ điển 9 bảng, ràng buộc toàn vẹn, chỉ mục và kiến trúc Cloud DBMS |

## 3. Quy ước hệ thống

- **Fxx**: Nhóm chức năng nghiệp vụ (F01 đến F08).
- **BR-xx**: Quy tắc nghiệp vụ (Business Rules).
- **AC-xx**: Tiêu chí nghiệm thu chức năng (Acceptance Criteria).
- **NFR-xx**: Yêu cầu phi chức năng (Non-Functional Requirements).
- **TC-xx**: Ca kiểm thử chức năng hoặc tích hợp (Test Cases).
- **DMS-xx, TRX-xx, CC-xx**: Thực nghiệm Storage, Transaction, Concurrency.
- **Qxx**: Truy vấn CSDL cốt lõi theo đề bài.
- **Vai trò người dùng**: `USER` (khách hàng cá nhân), `MANAGER` (quản trị viên danh mục & báo cáo).

Mọi thao tác dữ liệu được thực thi thông qua REST API có kiểm tra quyền hạn và phiên làm việc (JWT). Đăng nhập được thực hiện qua biểu mẫu chuẩn bằng thông tin tài khoản hợp lệ, không hỗ trợ cơ chế đăng nhập nhanh (Quick Demo). Hệ thống xử lý toàn bộ luồng nghiệp vụ vé bằng giao dịch nội bộ trong CSDL, hoàn toàn không hỗ trợ giao dịch tiền tệ bên thứ ba hay kết nối cổng thanh toán ngân hàng.

## 4. Quản lý phiên bản

| Phiên bản | Ngày | Nội dung thay đổi |
| --- | --- | --- |
| 0.x | 2026-09-01 | Phân tích ban đầu theo mô hình ghế đánh số |
| 1.0 | 2026-09-21 | Thống nhất mô hình vé theo loại/số lượng; bổ sung Auth & RBAC |
| 1.1 | 2026-09-25 | Cập nhật định vị Ứng dụng Web hiện đại (thay thế web tĩnh); bổ sung chức năng **F08: Gửi email mã vé cho khách hàng sau khi hoàn tất giao dịch**; chuẩn hóa API skeleton và cập nhật quy tắc Git nhóm |
| 1.2 | 2026-09-25 | Làm rõ vai trò bắt buộc của bộ script SQL (DDL schema, DML seeds, DQL queries) khi triển khai trên Cloud Managed DBMS (Aiven, AWS RDS, TiDB, Railway...) theo nguyên tắc Infrastructure as Code và tiêu chí chấm thi DBMS |

## 5. Căn cứ đề tài

Bộ tài liệu bám sát yêu cầu đề bài **Assignment_HK261_A01.pdf**:
- Ứng dụng kiểu Web application theo kiến trúc Client-Server / N-tier, có khả năng vận hành linh hoạt trên cả môi trường cục bộ (Localhost) và nền tảng đám mây (Cloud Database Services).
- Đáp ứng tối thiểu $n \ge 2 \times \text{số thành viên} = 6$ chức năng nghiệp vụ của người dùng (không tính đăng nhập/đăng xuất). Hệ thống EventBox hiện thực **8 chức năng nghiệp vụ (F01 - F08)**, vượt yêu cầu tối thiểu.
- Minh họa 3 chủ đề trọng tâm: **Data Storage & Management** (MySQL), **Transaction** (ACID & Booking Confirmation) và **Concurrency** (Redis TTL Hold & Tranh chấp vé). Bộ script SQL trong `database/mysql/` là tài sản thiết kế kiến trúc bắt buộc dùng để khởi tạo schema trên bất kỳ nền tảng Cloud nào.
