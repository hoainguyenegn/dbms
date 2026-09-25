# Phạm vi sản phẩm

Mã tài liệu: ETS-SCOPE | Phiên bản: 1.1 | Ngày: 2026-09-25

## 1. Mục tiêu

Hệ thống cho phép người quản lý công bố sự kiện, thiết lập các buổi tổ chức và phân phối vé theo loại. Khách hàng tìm kiếm sự kiện, chọn buổi, giữ vé trong thời gian giới hạn, xác nhận đặt vé (Booking Confirmation qua giao dịch CSDL nội bộ) và nhận email thông báo chứa mã vé điện tử để tham gia sự kiện.

Dự án được xây dựng dưới dạng Web Application theo kiến trúc Client-Server / N-tier, tương tác thời gian thực thông qua hệ thống RESTful API kết hợp cơ sở dữ liệu quan hệ MySQL và cơ sở dữ liệu in-memory Redis.

Bốn mục tiêu nghiệp vụ trọng tâm:

1. **Quản lý danh mục nhất quán:** Thông tin sự kiện, lịch tổ chức, địa điểm và các hạng vé được lưu trữ toàn vẹn, phân quyền quản trị rõ ràng.
2. **Kiểm soát sức chứa tuyệt đối (Concurrency & Storage):** Số lượng vé được giữ và bán không bao giờ vượt quá sức chứa phát hành, triệt tiêu hiện tượng overselling.
3. **Giao dịch tin cậy (ACID Transaction):** Đơn hàng, chi tiết đơn và các mã vé điện tử được phát hành nhất quán trong một transaction duy nhất, hỗ trợ hủy đơn an toàn trước giờ diễn.
4. **Trải nghiệm khách hàng khép kín (Post-Transaction Notification):** Sau khi hoàn tất giao dịch đặt vé, hệ thống tự động gửi email xác nhận chứa đầy đủ thông tin đơn hàng và mã vé điện tử cho khách hàng.

## 2. Đối tượng sử dụng và Phân quyền

Hệ thống áp dụng cơ chế xác thực danh tính (Authentication qua JWT và Bcrypt) kết hợp phân quyền dựa trên vai trò (Role-Based Access Control - RBAC) chặt chẽ:

| Vai trò (Role) | Trách nhiệm và quyền hạn |
| --- | --- |
| **USER** (Khách hàng) | Đăng nhập/Đăng xuất; tìm kiếm và xem sự kiện thời gian thực; giữ vé tạm thời; xác nhận đặt vé; nhận email mã vé điện tử; tra cứu lịch sử đơn và hủy đơn hàng hợp lệ thuộc quyền sở hữu của mình |
| **MANAGER** (Người quản lý) | Đăng nhập tài khoản quản trị, tạo, sửa, xóa nháp sự kiện cấu hình buổi tổ chức và loại vé, công bố sự kiện (`PUBLISHED`) hoặc đóng bán (`CLOSED`); theo dõi báo cáo thống kê doanh thu và phân tích tồn vé |

Quy định bảo mật phiên & Đăng nhập:
- Khách hàng mang vai trò `USER` bị từ chối truy cập (HTTP `403 Forbidden`) vào tất cả các tài nguyên quản trị `/api/admin/*`.
- Token JWT được kiểm tra ở middleware backend, mọi thao tác đặt vé, tra cứu đơn hay gửi lại email đều trích xuất định danh khách hàng từ token hợp lệ, không tin cậy `user_id` do client tự gửi.
- **Không hỗ trợ Quick Demo:** Mọi người dùng bắt buộc phải đăng nhập qua form chuẩn với tài khoản và mật khẩu cụ thể, không hỗ trợ nút bấm đăng nhập nhanh hay cơ chế bypass xác thực.

## 3. Phạm vi chức năng (8 Chức năng nghiệp vụ)

Hệ thống cung cấp **8 chức năng nghiệp vụ (F01 - F08)**:

| Mã | Nhóm chức năng | Kết quả cung cấp | Vai trò |
| --- | --- | --- | --- |
| F01 | Quản lý sự kiện | Danh mục sự kiện, mô tả, thể loại và vòng đời trạng thái (`DRAFT` -> `PUBLISHED` -> `CLOSED`) | `MANAGER` |
| F02 | Quản lý buổi tổ chức và loại vé | Địa điểm, thành phố, lịch biểu diễn/mở bán, các hạng vé, đơn giá VND và sức chứa (`capacity`) | `MANAGER` |
| F03 | Tìm kiếm và xem sự kiện | Khám phá sự kiện theo từ khóa, thể loại, thành phố; xem chi tiết suất diễn và tính tồn vé khả dụng thời gian thực | Công khai / `USER` |
| F04 | Giữ vé tạm thời | Cấp phiếu giữ chỗ có thời hạn (TTL 300s), kiểm tra tồn khả dụng, chống trùng lặp yêu cầu | `USER` |
| F05 | Xác nhận và hủy đặt vé | Thực thi giao dịch ACID: chốt đơn, sinh mã vé điện tử, giải phóng giữ vé, xử lý hủy đơn hợp lệ trước giờ diễn | `USER` |
| F06 | Tra cứu đơn và vé | Xem lịch sử các đơn hàng đã đặt, trạng thái đơn, chi tiết hạng vé và danh sách mã vé cá nhân | `USER` |
| F07 | Thống kê và báo cáo | Báo cáo tổng số vé xác nhận, tổng doanh thu, lọc theo sự kiện/buổi và truy vấn buổi chưa phát sinh đơn | `MANAGER` |
| F08 | Thông báo & Gửi vé qua Email | Tự động gửi email xác nhận kèm danh sách mã vé điện tử duy nhất cho khách hàng ngay khi hoàn tất giao dịch; hỗ trợ gửi lại email từ lịch sử đơn hàng | `USER` / Hệ thống |

## 4. Luồng nghiệp vụ chính

1. Khách hàng tìm kiếm sự kiện -> Xem chi tiết suất diễn và tồn vé khả dụng (F03).
2. Chọn loại vé và số lượng (1 đến 6 vé) -> Hệ thống cấp phiếu giữ vé tạm thời (F04, TTL 300 giây).
3. Kiểm tra thông tin đơn vé -> Xác nhận đặt vé (F05 - ACID Transaction nội bộ trong CSDL).
4. Hệ thống ghi nhận đơn hàng `CONFIRMED`, phát hành các mã vé điện tử duy nhất (F05) -> **Tự động gửi email xác nhận kèm danh sách mã vé điện tử cho khách hàng (F08)**.
5. Khách hàng có thể tra cứu lại đơn hàng và danh sách vé bất cứ lúc nào trong mục lịch sử đơn (F06), hoặc bấm nút "Gửi lại email mã vé" nếu cần.
6. Trường hợp không thể tham gia, khách hàng có quyền hủy toàn bộ đơn trước giờ bắt đầu suất diễn (F05).

## 5. Tham số và giới hạn phiên bản

| Nội dung | Quy định |
| --- | --- |
| Thời gian giữ vé (Hold TTL) | Tối đa 300 giây, không vượt quá thời điểm ngừng bán của buổi |
| Số vé mỗi đơn | Từ 1 đến 6 vé (tính tổng các loại vé trong một lần đặt) |
| Phạm vi một đơn | Thuộc đúng một khách hàng và một buổi tổ chức cụ thể |
| Hủy đơn hàng | Cho phép hủy toàn bộ đơn trước thời điểm bắt đầu biểu diễn; không hủy từng vé lẻ |
| Đơn vị tiền tệ | Việt Nam Đồng (VND), số nguyên từ 0 đến 1.000.000.000 VND (phục vụ định giá và thống kê nội bộ) |
| Vòng đời cấu hình | Chỉ sửa thông tin sự kiện, buổi, vé khi ở trạng thái `DRAFT` |
| Toàn vẹn lịch sử | Không xóa cứng bản ghi đơn hàng hay vé đã phát sinh; lưu vết trạng thái rõ ràng |
| Gửi email mã vé | Thực hiện bất đồng bộ sau khi giao dịch MySQL đã commit; lỗi gửi mail không làm rollback đơn hàng |

## 6. Ngoài phạm vi (Out of Scope)

- **Giao dịch tiền tệ bên thứ ba / Ngân hàng:** Hệ thống KHÔNG hỗ trợ kết nối tới bất kỳ cổng thanh toán ngân hàng, ví điện tử hay dịch vụ tài chính bên thứ 3 nào (như VNPAY, MoMo, ZaloPay, VietQR, Stripe, PayPal...). Toàn bộ quy trình đặt vé và ghi nhận đơn hàng là giao dịch cơ sở dữ liệu nội bộ (Internal DBMS Transaction). Giá trị `total_amount_vnd` chỉ phục vụ mục đích tính toán giá trị đơn vé và báo cáo thống kê doanh thu nội bộ của đồ án.
- **Không hỗ trợ Quick Demo / Bypass:** Quá trình truy cập hệ thống bắt buộc phải đăng nhập bằng thông tin tài khoản hợp lệ (`username` và `password`), không cung cấp nút bấm đăng nhập tắt hay cơ chế tự động điền vượt qua xác thực.
- Sơ đồ chọn chỗ ngồi đánh số (Seat map) — bán vé theo hạng vé và số lượng (General Admission / Tiered Capacity).
- Cổng soát vé phần cứng, máy quét barcode/QR tại cửa hội trường.
- Tổng đài tin nhắn SMS Brandname trả phí.

## 7. Kiến trúc và trách nhiệm dữ liệu

Hệ thống được thiết kế theo mô hình **Kiến trúc phân tầng hiện đại (N-tier Architecture)**:

```
┌────────────────────────────────────────────────────────┐
│             Frontend: React 19 SPA (Vite)              │
│    UI Khám phá, Đặt vé, Quản trị Manager, AuthContext  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / RESTful API (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Backend: Node.js (Express 5)               │
│   Auth & RBAC Middleware, Controllers, Error Handler   │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       SQL Queries / Pool           In-memory Cache
                ▼                        ▼
┌──────────────────────────────┐ ┌───────────────────────┐
│     MySQL 8.0 (InnoDB)       │ │      Redis 7.0        │
│ CSDL chính, Khóa ngoại, CHECK│ │ Bộ đệm giữ vé nhanh,  │
│  Transactions, ACID, Storage │ │ Quản lý TTL 300s      │
└──────────────────────────────┘ └───────────────────────┘
```

- **Frontend (React 19 + Vite):** Ứng dụng Single Page Application hiện đại, chia thành các module giao diện độc lập: Khám phá sự kiện (F03), Quản trị sự kiện & suất diễn (F01, F02), Giữ vé & Đặt vé (F04, F05), Lịch sử đơn & Email (F06, F08) và Báo cáo (F07).
- **Backend (Node.js + Express):** Điều phối toàn bộ nghiệp vụ, xác thực JWT, kiểm tra ràng buộc thời gian thực, đảm bảo transaction và kích hoạt dịch vụ gửi email sau giao dịch.
- **MySQL 8.0 (InnoDB):** Nguồn dữ liệu tin cậy tối cao (Single Source of Truth), quản lý người dùng, sự kiện, đơn vé, lịch sử và đảm bảo tính toàn vẹn khóa ngoại (Composite Foreign Keys).
- **Redis 7.0:** Tăng tốc độ đọc phiếu giữ vé và quản lý hết hạn tự động qua TTL (Time-To-Live).

## 8. Khả năng vận hành trên Cloud DBMS & Vai trò bộ script SQL

Hệ thống EventBox được thiết kế độc lập với hạ tầng vật lý (Cloud-agnostic):
- **Vận hành trên máy cục bộ (Localhost):** Sử dụng MySQL 8.0 và Redis 7.0 cài qua Homebrew / Docker / System Service.
- **Vận hành trên nền tảng Đám mây (Cloud Managed DBMS):** Tương thích hoàn toàn với các dịch vụ Database Cloud phổ biến (như **Aiven MySQL, AWS RDS, GCP Cloud SQL, TiDB Cloud, Railway, Clever Cloud** và **Upstash Redis**).

### Vai trò của các file SQL khi triển khai Cloud / Local:
Dù vận hành trên Localhost hay Cloud (Aiven MySQL, AWS RDS, TiDB Cloud, Railway...):
1. **Dịch vụ Cloud chỉ cấp máy chủ rỗng (Empty Instance):** Nền tảng Cloud chỉ cung cấp địa chỉ kết nối và một database rỗng chưa có bất kỳ bảng nào.
2. **File SQL DDL (`migrations/001_init_schema.sql`) dùng để khởi tạo schema:** Định nghĩa cấu trúc 9 bảng quan hệ, các ràng buộc toàn vẹn quan trọng (`CHECK constraints`, khóa ngoại phức hợp), khóa chính và các chỉ mục. Hiện tại nhóm chưa tạo các file SQL này mà lưu trữ toàn bộ đặc tả trong tài liệu thiết kế CSDL (`docs/database-design.md`) trước khi chuyển giao sang DDL.
3. **File SQL DML (`seeds/001_seed_fixture.sql`) cung cấp dữ liệu Demo:** Khởi tạo tài khoản `manager01`, `user01`, các sự kiện mẫu, suất diễn và loại vé để hội đồng chấm thi có thể thực nghiệm ngay.
4. **Tiêu chuẩn học thuật & Infrastructure as Code (IaC):** Bộ file SQL là bằng chứng nộp bài đánh giá năng lực thiết kế CSDL của nhóm, đồng thời đảm bảo khả năng tái tạo hệ thống trên bất kỳ Cloud nào chỉ trong vài giây.

## 9. Phân công trách nhiệm 3 thành viên

| Thành viên | Chủ đề DBMS | Chức năng nghiệp vụ & Phạm vi phụ trách |
| --- | --- | --- |
| **Thành viên 1** | **Data Storage & Management** | • **F01**: Quản lý vòng đời sự kiện (`DRAFT`, `PUBLISHED`, `CLOSED`)<br>• **F02**: Quản lý buổi tổ chức & cơ cấu loại vé<br>• **F03**: Khám phá sự kiện & tính toán tồn vé động thời gian thực<br>• Thiết kế cấu trúc CSDL quan hệ, migrations DDL, seeds DML, Auth & RBAC nền tảng<br>• Màn hình Quản trị Sự kiện & Suất diễn (`MANAGER`) và Khám phá (`USER`) |
| **Thành viên 2** | **Transaction** | • **F05**: Xác nhận đặt vé (ACID Transaction) và xử lý hủy đơn an toàn (giao dịch nội bộ DBMS, không hỗ trợ thanh toán ngân hàng bên thứ 3)<br>• **F06**: Quản lý và tra cứu lịch sử đơn hàng, chi tiết vé<br>• **F08**: **Thông báo & Gửi vé điện tử qua Email sau giao dịch**<br>• Nghiên cứu Isolation Levels, Rollback/Commit và tính nhất quán đơn hàng<br>• Màn hình Xác nhận đặt vé, Lịch sử đơn hàng và Gửi lại email vé |
| **Thành viên 3** | **Concurrency** | • **F04**: Giữ vé tạm thời với cơ chế khóa lạc quan / TTL Redis<br>• **F07**: Thống kê báo cáo doanh thu & phân tích tồn vé<br>• Nghiên cứu hiện tượng Race Condition, Overselling và xử lý tranh chấp vé đồng thời<br>• Màn hình Giữ vé tạm thời và Dashboard Báo cáo thống kê (`MANAGER`) |

