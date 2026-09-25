# EventBox — Hệ thống Đặt vé Sự kiện Trực tuyến
> **Đồ án môn học: Hệ quản trị Cơ sở dữ liệu (DBMS - HK261)**  
> **Kiến trúc:** N-tier Web Application
> **Công nghệ:** React 19 (SPA) · Node.js & Express 5 (REST API) · MySQL 8.0 (InnoDB) · Redis 7.0 (In-memory)

---

## 1. Giới thiệu tổng quan

**EventBox** là ứng dụng web đặt vé sự kiện trực tuyến phục vụ đồ án môn **Hệ quản trị Cơ sở dữ liệu (DBMS)**. 

Hệ thống được thiết kế để minh họa và thực nghiệm 3 chủ đề DBMS cốt lõi:
1. **Data Storage & Management** 
2. **Transaction** 
3. **Concurrency** 

---

## 2. Xác thực (Authentication) & Phân quyền (RBAC)

| Vai trò (Role) | Quyền hạn và Trách nhiệm nghiệp vụ |
|:---|:---|
| **`MANAGER`** (Quản lý) | Quản lý danh mục sự kiện (F01), cấu hình buổi biểu diễn và các loại vé (F02), xuất bản/đóng sự kiện, xem báo cáo doanh thu và phân tích tồn vé (F07). |
| **`USER`** (Khách hàng) | Tìm kiếm sự kiện (F03), giữ vé tạm thời 300s (F04), đặt vé qua ACID Transaction (F05), tra cứu lịch sử đơn hàng (F06), nhận thông báo và gửi lại email mã vé điện tử (F08). Bị chặn truy cập các API quản trị (`/api/admin/*`). |

---

## 3. Danh mục 8 Chức năng Nghiệp vụ (F01 – F08)

| STT | Mã | Tên chức năng | Mô tả nghiệp vụ | Vai trò | Chủ đề DBMS |
|:---:|:---:|:---|:---|:---:|:---:|
| 1 | **F01** | Quản lý sự kiện | Tạo, cập nhật, xóa nháp sự kiện; quản lý vòng đời trạng thái (`DRAFT` → `PUBLISHED` → `CLOSED`). | `MANAGER` | Storage |
| 2 | **F02** | Quản lý suất diễn & loại vé | Thiết lập địa điểm, thành phố, lịch mở bán/kết thúc; định nghĩa các hạng vé (VIP, Standard...), đơn giá VND và sức chứa (`capacity`). | `MANAGER` | Storage |
| 3 | **F03** | Tìm kiếm & Xem chi tiết sự kiện | Tìm kiếm theo từ khóa, thể loại, thành phố; xem chi tiết suất diễn và tính toán tồn vé khả dụng thời gian thực. | Public / `USER` | Storage |
| 4 | **F04** | Giữ vé tạm thời (Reservation Hold) | Cấp phiếu giữ vé có thời hạn (TTL 300s) chống cướp vé; kiểm tra sức chứa khả dụng; chống trùng lặp yêu cầu qua `request_key`. | `USER` | Concurrency |
| 5 | **F05** | Xác nhận & Hủy đặt vé | Xác nhận đơn hàng qua **ACID Transaction**: sinh mã vé điện tử, giải phóng phiếu giữ; hỗ trợ hủy toàn bộ đơn trước giờ diễn. | `USER` | Transaction |
| 6 | **F06** | Tra cứu lịch sử đơn vé | Xem danh sách các đơn đã đặt, trạng thái đơn (`CONFIRMED`, `CANCELLED`), chi tiết từng vé và thông tin sự kiện. | `USER` | Transaction |
| 7 | **F07** | Thống kê & Báo cáo doanh thu | Tổng hợp số vé bán ra, tổng doanh thu theo sự kiện/buổi; thống kê tỷ lệ lấp đầy sức chứa; truy vấn các buổi chưa có đơn hàng. | `MANAGER` | Concurrency / Storage |
| 8 | **F08** | Thông báo & Gửi vé qua Email | Tự động gửi email xác nhận kèm danh sách mã vé điện tử duy nhất cho khách hàng ngay khi hoàn tất giao dịch; hỗ trợ gửi lại email từ trang lịch sử đơn. | `USER` / Hệ thống | Transaction / Integration |

---

## 4. Thiết kế Cơ sở Dữ liệu & Kiến trúc Vận hành (Local & Cloud DBMS)

### 4.1. Tài liệu Thiết kế & Mô tả Cơ sở Dữ liệu
Đồ án đã xây dựng bộ tài liệu kỹ thuật hoàn chỉnh:
👉 **[Xem chi tiết: docs/database-design.md](docs/database-design.md)**
- **Mô hình Khái niệm & ERD (Mermaid):** Biểu diễn 7 thực thể và quan hệ nghiệp vụ.
- **Từ điển dữ liệu (Data Dictionary):** Cấu trúc 9 bảng quan hệ (`users`, `events`, `event_showings`, `ticket_types`, `reservations`, `reservation_items`, `bookings`, `booking_items`, `tickets`).
- **Chiến lược Đánh Chỉ mục (Index Strategy):** Tối ưu 8 loại câu lệnh truy vấn đề bài (Insert, Delete, Update, Simple Query, Composite Query, Join, Subquery, Aggregate).

---

## 5. Hướng dẫn Cài đặt & Chạy ứng dụng

### Yêu cầu hệ thống:
- **Node.js:** Phiên bản 20+ (Khuyên dùng Node 22 LTS).
- **Cơ sở dữ liệu:** MySQL 8.0+ và Redis 7.0+.

### Các bước khởi chạy:

```bash
# 1. Cài đặt thư viện cho cả Backend và Frontend
npm --prefix backend install
npm --prefix frontend install

# 3. Khởi động Backend (Terminal 1)
npm --prefix backend run dev
# -> Server REST API hoạt động tại: http://localhost:3000

# 4. Khởi động Frontend (Terminal 2)
npm --prefix frontend run dev
# -> Giao diện Web hoạt động tại: http://localhost:5173
```

### Chạy kiểm thử tự động:
```bash
# Chạy bộ test suite của backend (Auth, Role Guard, Error Handler)
npm --prefix backend test

# Kiểm tra cú pháp và build giao diện
npm --prefix frontend run lint
npm --prefix frontend run build
```

---

## 7. Quy tắc Git & Phối hợp Nhóm (Team Git Conventions)

Để đảm bảo 3 thành viên làm việc song song không gây xung đột mã nguồn (merge conflicts) và giữ mã nguồn luôn ổn định:

### 7.1. Chiến lược phân nhánh (Branching Strategy)
```
  main         ────────────────────────────────────────● [Bản demo bảo vệ]
                ▲                                     ▲
  develop      ─┼─────────────────●─────────────────●─┴─ [Tích hợp chung]
                │                 ▲                 ▲
  feature/*    ─┴─ feature/f01 ───┘                 │
               └───────── feature/f04-f07 ──────────┘
```
- **`main`:** Nhánh chính, phản ánh trạng thái mã nguồn ổn định nhất phục vụ demo và nộp bài cho Giảng viên. Tuyệt đối **không commit trực tiếp** lên `main`.
- **`develop`:** Nhánh tích hợp trung tâm của cả nhóm. Mọi tính năng sau khi kiểm tra xong sẽ được hợp nhất (merge) vào đây.
- **`feature/<mã-chức-năng>-<tên-ngắn>`:** Nhánh làm việc độc lập của từng thành viên:
  - `feature/f01-f02-events`: Quản lý sự kiện, suất diễn, loại vé (Thành viên 1).
  - `feature/f05-f06-f08-bookings`: Đặt vé ACID, lịch sử đơn, email vé (Thành viên 2).
  - `feature/f04-f07-redis-reports`: Giữ vé Redis TTL, báo cáo doanh thu (Thành viên 3).

### 7.2. Quy tắc Commit (Conventional Commits)
Thông điệp commit phải rõ ràng, tuân thủ tiền tố:
- `feat:` Thêm chức năng nghiệp vụ mới (ví dụ: `feat(f08): add email ticket notification service`).
- `fix:` Sửa lỗi (ví dụ: `fix(auth): prevent duplicate username registration`).
- `docs:` Cập nhật tài liệu đặc tả, readme (ví dụ: `docs: update cloud db setup guide`).
- `test:` Bổ sung kịch bản kiểm thử (ví dụ: `test: add unit test for acid booking rollback`).
- `refactor:` Tối ưu mã nguồn nhưng không đổi nghiệp vụ (ví dụ: `refactor: clean up db connection pool`).

### 7.3. Quy trình Pull Request (PR) & Code Review
1. Trước khi tạo PR, kéo code mới nhất từ `develop` về nhánh của mình và chạy test:
   ```bash
   git checkout develop && git pull origin develop
   git checkout feature/your-feature
   git merge develop
   npm --prefix backend test
   ```
2. Tạo Pull Request trên GitHub hướng vào nhánh `develop`.
3. Ít nhất 1 thành viên khác trong nhóm xem lại (Review) và Approve trước khi merge.
4. Tuyệt đối **không commit file `.env` chứa mật khẩu thực tế** hoặc thư mục `node_modules/` vào Git.

---

## 8. Bảng Tổng hợp Thiết kế API Skeleton

Tất cả các endpoint tuân thủ chuẩn RESTful API, định dạng JSON và có mã trạng thái HTTP chuẩn mực:

| Chức năng | Phương thức | Đường dẫn API | Xác thực & Quyền | Mô tả nghiệp vụ |
|:---|:---:|:---|:---:|:---|
| **Hệ thống** | `GET` | `/` | Public | Thông tin phiên bản API |
| **Hệ thống** | `GET` | `/health` | Public | Kiểm tra kết nối MySQL và Redis |
| **Auth** | `POST` | `/api/auth/login` | Public | Đăng nhập tài khoản, trả về JWT Token |
| **Auth** | `POST` | `/api/auth/logout` | Đã đăng nhập | Đăng xuất phiên làm việc |
| **Auth** | `GET` | `/api/auth/me` | Đã đăng nhập | Lấy thông tin tài khoản và vai trò người dùng |
| **F03** | `GET` | `/api/events` | Public | Tìm kiếm sự kiện công khai (lọc keyword, category, city) |
| **F03** | `GET` | `/api/events/:id` | Public | Chi tiết sự kiện, danh sách suất diễn và tồn vé khả dụng |
| **F01** | `GET` | `/api/admin/events` | `MANAGER` | Lấy toàn bộ danh sách sự kiện theo trạng thái |
| **F01** | `POST` | `/api/admin/events` | `MANAGER` | Tạo sự kiện mới (trạng thái ban đầu `DRAFT`) |
| **F01** | `PATCH` | `/api/admin/events/:id` | `MANAGER` | Chỉnh sửa thông tin sự kiện nháp |
| **F01** | `DELETE` | `/api/admin/events/:id` | `MANAGER` | Xóa sự kiện nháp chưa bán vé |
| **F01** | `POST` | `/api/admin/events/:id/publish` | `MANAGER` | Công bố sự kiện mở bán (`DRAFT` → `PUBLISHED`) |
| **F01** | `POST` | `/api/admin/events/:id/close` | `MANAGER` | Đóng bán vé sự kiện (`PUBLISHED` → `CLOSED`) |
| **F02** | `POST` | `/api/admin/events/:id/showings` | `MANAGER` | Thêm suất diễn mới cho sự kiện |
| **F02** | `DELETE` | `/api/admin/showings/:id` | `MANAGER` | Xóa suất diễn thuộc sự kiện nháp |
| **F02** | `POST` | `/api/admin/showings/:id/ticket-types` | `MANAGER` | Cấu hình loại vé, đơn giá và số lượng phát hành |
| **F02** | `DELETE` | `/api/admin/ticket-types/:id` | `MANAGER` | Xóa loại vé thuộc sự kiện nháp |
| **F04** | `POST` | `/api/reservations` | `USER` | Tạo phiếu giữ vé tạm thời (TTL 300 giây trên Redis) |
| **F04** | `GET` | `/api/reservations/:id` | `USER` | Tra cứu trạng thái phiếu giữ và thời gian còn lại |
| **F05** | `POST` | `/api/bookings/confirm` | `USER` | Xác nhận đặt vé qua ACID Transaction |
| **F05** | `POST` | `/api/bookings/:id/cancel` | `USER` | Hủy đơn hàng hợp lệ trước giờ biểu diễn |
| **F06** | `GET` | `/api/bookings/my` | `USER` | Tra cứu danh sách đơn hàng đã đặt của cá nhân |
| **F06** | `GET` | `/api/bookings/:id` | `USER` | Xem chi tiết đơn hàng và danh sách mã vé điện tử |
| **F07** | `GET` | `/api/admin/reports/bookings` | `MANAGER` | Báo cáo doanh thu, vé bán và phân tích hiệu suất |
| **F08** | `POST` | `/api/bookings/:id/send-email` | `USER` / Hệ thống | Gửi email thông báo mã vé điện tử cho khách hàng |

---

## 9. Phân công Trách nhiệm Thành viên

| Thành viên | Trách nhiệm chính (DBMS Core Area) | Phạm vi Nghiệp vụ & API | Giao diện đảm nhiệm (UI Module) |
|:---|:---|:---|:---|
| **Thành viên 1**  | **Data Storage & Management** | • Thiết kế lược đồ CSDL quan hệ chuẩn hóa 3NF/BCNF.<br>• Viết DDL migration (`001_init_schema.sql`) và seed (`001_seed_fixture.sql`).<br>• Xây dựng nền tảng Auth & RBAC (`/api/auth/*`).<br>• Thực hiện **F01** (Quản lý sự kiện), **F02** (Suất diễn & Loại vé) và **F03** (Khám phá công khai). | • Trang chủ khám phá sự kiện (F03)<br>• Modal chi tiết sự kiện & xem vé<br>• Bảng điều khiển Quản trị viên sự kiện (`MANAGER` - F01, F02)<br>• Modal Đăng nhập |
| **Thành viên 2** | **Transaction Processing** | • Thiết kế và thực thi giao dịch ACID xác nhận đặt vé (**F05**).<br>• Quản lý lịch sử đơn hàng (**F06**).<br>• Tích hợp gửi email mã vé điện tử tự động (**F08**). | • Luồng thanh toán & Xác nhận đơn hàng (F05)<br>• Trang Lịch sử đơn hàng cá nhân (F06)<br>• Chức năng bấm gửi lại email vé điện tử (F08) |
| **Thành viên 3** | **Concurrency Control** | • Quản lý tranh chấp giữ vé tạm thời bằng Redis Lua script và TTL 300s (**F04**).<br>• Thiết kế các câu truy vấn thống kê, tổng hợp doanh thu và báo cáo hiệu suất (**F07**). | • Giao diện chọn vé và đếm ngược thời gian giữ vé 300s (F04)<br>• Bảng điều khiển Báo cáo thống kê doanh thu (`MANAGER` - F07) |

---

## 10. Tài liệu Thiết kế & Phân tích Nghiệp vụ

Toàn bộ hồ sơ kỹ thuật của đồ án được tổ chức khoa học và chuẩn mực:
- ⭐️ **[Tài liệu Thiết kế & Mô tả CSDL chi tiết (docs/database-design.md)](docs/database-design.md):** Bản thiết kế kiến trúc CSDL chính thức của đồ án: Phân tích chuẩn hóa 3NF/BCNF, từ điển 9 bảng quan hệ, ràng buộc toàn vẹn, chỉ mục tối ưu và kiến trúc Cloud Managed Database.
- [`docs/ba/README.md`](docs/ba/README.md): Tổng quan bộ hồ sơ đặc tả nghiệp vụ EventBox.
- [`docs/ba/00-product-scope.md`](docs/ba/00-product-scope.md): Phạm vi sản phẩm, kiến trúc N-tier, phân quyền RBAC và khả năng vận hành Cloud/Local.
- [`docs/ba/01-requirements.md`](docs/ba/01-requirements.md): Quy tắc nghiệp vụ (BR-01 đến BR-23), tiêu chí nghiệm thu F01–F08 và API skeleton.
