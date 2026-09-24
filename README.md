# EventBox — Đồ án môn Cơ sở dữ liệu (DBMS)

Đồ án môn **Cơ sở dữ liệu (HK261)** · Node.js · MySQL · Redis

---

## Tổng quan

**EventBox** là đề tài hệ thống đặt vé sự kiện trực tuyến phục vụ môn học **Cơ sở dữ liệu (DBMS)**. Hệ thống bao gồm REST API backend, cơ sở dữ liệu và trang web tĩnh giới thiệu đồ án. Dự án được xây dựng nhằm minh họa và thực nghiệm ba chủ đề DBMS trọng tâm: **Data Storage & Management**, **Transaction** và **Concurrency** trên MySQL 8.x và Redis 7.x. 

Phần giao diện người dùng (UI) phục vụ chức năng nghiệp vụ và thực nghiệm demo do từng thành viên tự thiết kế và triển khai độc lập theo phân công.

Tài liệu phân tích nghiệp vụ chi tiết tại [`docs/ba/`](docs/ba/).

---

## Kiến trúc

```
Web tĩnh / UI Demo  ──HTTP──▶  Node.js (Express)  ──▶  MySQL 8.x
                                                  ──▶  Redis 7.x
```

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | Web tĩnh / UI demo | Trang chủ giới thiệu Đồ án DBMS; UI nghiệp vụ mỗi người tự làm |
| Backend | Node.js + Express | REST API, kiểm tra nghiệp vụ |
| Database chính | MySQL 8.x | Danh mục sự kiện, đơn vé, lịch sử |
| Cache / giữ vé | Redis 7.x | Bản đọc nhanh phiếu giữ, quản lý TTL |

---

## Cấu trúc repository

```
DBMS/
├── frontend/          # React + Vite
│   └── src/
│       ├── pages/     # Các trang giao diện
│       ├── App.jsx
│       └── main.jsx
├── backend/           # Node.js + Express
│   └── src/
│       ├── config/    # Kết nối MySQL, Redis
│       ├── app.js
│       └── server.js
├── database/
│   ├── mysql/         # Migrations, seeds, queries
│   └── redis/         # Lua scripts
├── docs/ba/           # Tài liệu phân tích nghiệp vụ
├── .env.example       # Mẫu cấu hình
└── README.md
```

---

## Cài đặt và chạy

### Yêu cầu

- Node.js 20+ (khuyên dùng Node 22 LTS)
- MySQL 8.x (cài đặt cục bộ)
- Redis 7.x (cài đặt cục bộ)

### 1. Biến môi trường

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

- Cấu hình thông tin kết nối MySQL và Redis trong `.env` sao cho khớp với cài đặt trên máy của bạn.
- `frontend/.env`: địa chỉ API backend (`VITE_API_URL=http://localhost:3000`).

### 2. Cài dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3. Khởi động database

Đảm bảo dịch vụ MySQL và Redis trên máy đang hoạt động:

```bash
# Trên macOS (nếu dùng Homebrew):
brew services start mysql
brew services start redis

# Trên Linux:
sudo systemctl start mysql
sudo systemctl start redis

# Kiểm tra nhanh:
redis-cli ping               # Trả về PONG
```

### 4. Chạy backend

```bash
npm --prefix backend run dev
# API tại http://localhost:3000
```

### 5. Chạy frontend

```bash
npm --prefix frontend run dev
# Giao diện tại http://localhost:5173
```

---

## API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/` | Tên và phiên bản API |
| GET | `/health/live` | Express đang chạy |
| GET | `/health` | Trạng thái MySQL và Redis |

Các endpoint nghiệp vụ đầy đủ được mô tả tại [`docs/ba/01-requirements.md §6`](docs/ba/01-requirements.md).

---

## Sử dụng hằng ngày

```bash
# Chạy đồng thời 2 terminal
npm --prefix backend run dev    # terminal 1
npm --prefix frontend run dev   # terminal 2

# Dừng: Ctrl+C ở các terminal
```

---

## Xử lý lỗi thường gặp

| Triệu chứng | Kiểm tra |
|---|---|
| Không kết nối được MySQL / Redis | Đảm bảo service MySQL/Redis cục bộ đang chạy và tài khoản/mật khẩu trong file `.env` đã chính xác |
| Frontend không gọi được API | Kiểm tra `VITE_API_URL` và `FRONTEND_URL`; restart dev server sau khi sửa `.env` |
| Port bị chiếm (3000 hoặc 5173) | Đóng tiến trình đang dùng cổng hoặc đổi PORT khác trong `.env` |

---

## Quy trình làm việc nhóm

```
main        ← bản ổn định để demo
develop     ← tích hợp công việc nhóm
feature/*   ← phát triển từng chức năng
```

Commit: `package.json`, `package-lock.json`, `*.env.example`  
Không commit: `.env`, `node_modules/`, `dist/`, secret/mật khẩu thật

---

## Phân công
 
| Chủ đề | Thành viên | Phạm vi & UI Demo |
|---|---|---|
| Storage & Management | Thành viên 1 | F01, F02, F03; mô hình dữ liệu; UI quản lý sự kiện/buổi/loại vé |
| Transaction | Thành viên 2 | F05, F06; xác nhận và hủy đặt vé; UI đặt vé/chi tiết đơn |
| Concurrency | Thành viên 3 | F04, F07; giữ vé tạm thời và thống kê; UI giữ vé/báo cáo |

Chi tiết phân công tại [`docs/ba/00-product-scope.md §8`](docs/ba/00-product-scope.md).
