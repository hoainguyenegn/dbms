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
|:---|:---|:---|:---|
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
👉 **[Xem chi tiết: docs/database-design.md](docs/database-design.md)**

---

## 5. Hướng dẫn Khởi chạy Ứng dụng

### Yêu cầu hệ thống:
- **Node.js:** Phiên bản 20+ (Khuyên dùng Node 22 LTS).

### Các bước khởi chạy:

```bash
# 1. Cài đặt dependencies cho Backend và Frontend
npm --prefix backend install
npm --prefix frontend install

# 2. Khởi động Backend API Skeleton (Terminal 1)
npm --prefix backend run dev
# -> Server REST API hoạt động tại: http://localhost:3000

# 3. Khởi động Frontend Homepage (Terminal 2)
npm --prefix frontend run dev
# -> Giao diện Homepage hoạt động tại: http://localhost:5173
```

### Kiểm tra cú pháp và build giao diện:
```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

---

## 6. Quy tắc Git & Phối hợp Nhóm (Team Git Conventions)

Để đảm bảo 3 thành viên làm việc song song không gây xung đột mã nguồn (merge conflicts) và giữ mã nguồn luôn ổn định:

### 6.1. Chiến lược phân nhánh (Branching Strategy)
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

### 6.2. Quy tắc Commit (Conventional Commits)
Thông điệp commit phải rõ ràng, tuân thủ tiền tố:
- `feat:` Thêm chức năng nghiệp vụ mới (ví dụ: `feat(f08): add email ticket notification service`).
- `fix:` Sửa lỗi (ví dụ: `fix(auth): prevent duplicate username registration`).
- `docs:` Cập nhật tài liệu đặc tả, readme (ví dụ: `docs: update cloud db setup guide`).
- `test:` Bổ sung kịch bản kiểm thử (ví dụ: `test: add unit test for acid booking rollback`).
- `refactor:` Tối ưu mã nguồn nhưng không đổi nghiệp vụ (ví dụ: `refactor: clean up db connection pool`).

### 6.3. Quy trình Pull Request (PR) & Code Review
1. Trước khi tạo PR, kéo code mới nhất từ `develop` về nhánh của mình:
   ```bash
   git checkout develop && git pull origin develop
   git checkout feature/your-feature
   git merge develop
   ```
2. Tạo Pull Request trên GitHub hướng vào nhánh `develop`.
3. Ít nhất 1 thành viên khác trong nhóm xem lại (Review) và Approve trước khi merge.

---

## 7. Bảng Tổng hợp Thiết kế API Skeleton

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
| **F05** | `POST` | `/api/bookings/confirm` | `USER` | **Xác nhận đặt vé qua ACID Transaction** |
| **F05** | `POST` | `/api/bookings/:id/cancel` | `USER` | Hủy đơn hàng hợp lệ trước giờ biểu diễn |
| **F06** | `GET` | `/api/bookings/my` | `USER` | Tra cứu danh sách đơn hàng đã đặt của cá nhân |
| **F06** | `GET` | `/api/bookings/:id` | `USER` | Xem chi tiết đơn hàng và danh sách mã vé điện tử |
| **F07** | `GET` | `/api/admin/reports/bookings` | `MANAGER` | Báo cáo doanh thu, vé bán và phân tích hiệu suất |
| **F08** | `POST` | `/api/bookings/:id/send-email` | `USER` / Hệ thống | Gửi email thông báo mã vé điện tử cho khách hàng |

---
