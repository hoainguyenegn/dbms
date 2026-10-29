SET NAMES utf8mb4;

-- ============================================================================
-- Dữ liệu mẫu khởi tạo (DML Seed Fixture) - Hệ thống EventBox
-- Phục vụ kiểm thử chức năng F01, F02, F03 (Thành viên 1)
-- Mật khẩu mặc định cho các tài khoản mẫu: password123
-- ============================================================================

USE event_ticketing;

-- 1. Tài khoản người dùng mẫu (Bcrypt hash của 'password123')
INSERT INTO users (id, username, password_hash, full_name, email, role) VALUES
(1, 'manager1', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Nguyễn Quản Trị', 'manager@eventbox.vn', 'MANAGER'),
(2, 'customer1', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Trần Khách Hàng', 'customer1@gmail.com', 'USER'),
(3, 'customer2', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Lê Thị Thu', 'customer2@gmail.com', 'USER')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP(3);

-- 2. Danh mục sự kiện mẫu (Đầy đủ vòng đời: DRAFT, PUBLISHED, CLOSED)
INSERT INTO events (id, event_code, title, category, status, description) VALUES
(1, 'EVT-CONCERT-01', 'Đêm Nhạc Mùa Thu 2026: Giai Điệu Ký Ức', 'MUSIC', 'PUBLISHED', 'Đại nhạc hội quy tụ nhiều nghệ sĩ hàng đầu với hệ thống âm thanh ánh sáng chuẩn quốc tế.'),
(2, 'EVT-THEATER-02', 'Vở Kịch Hoàng Tử Bé', 'THEATER', 'PUBLISHED', 'Tác phẩm kịch nghệ kinh điển chuyển thể sân khấu đương đại giàu tính nhân văn.'),
(3, 'EVT-WORKSHOP-03', 'Workshop Thiết Kế UI/UX Thực Chiến', 'WORKSHOP', 'DRAFT', 'Buổi đào tạo kỹ năng thiết kế giao diện và trải nghiệm người dùng cho sinh viên.'),
(4, 'EVT-SPORTS-04', 'Giải Chạy Marathon Mùa Hè 2026', 'SPORTS', 'CLOSED', 'Giải chạy cộng đồng thường niên đã kết thúc kỳ mở bán.')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP(3);

-- 3. Suất diễn / Buổi tổ chức mẫu
INSERT INTO event_showings (id, event_id, showing_code, venue_name, city_code, sales_start_at, sales_end_at, starts_at, ends_at) VALUES
(1, 1, 'SHW-CONCERT-HCM', 'Nhà hát Hòa Bình, Q.10', 'HCM', 
  '2026-09-01 00:00:00.000', '2026-11-20 23:59:59.000', '2026-11-25 19:30:00.000', '2026-11-25 22:30:00.000'),
(2, 1, 'SHW-CONCERT-HN', 'Trung tâm Hội nghị Quốc gia', 'HN', 
  '2026-09-05 00:00:00.000', '2026-12-01 23:59:59.000', '2026-12-05 19:30:00.000', '2026-12-05 22:30:00.000'),
(3, 2, 'SHW-THEATER-HCM', 'Nhà hát Thành Phố, Q.1', 'HCM', 
  '2026-09-10 00:00:00.000', '2026-11-28 18:00:00.000', '2026-11-30 20:00:00.000', '2026-11-30 22:15:00.000')
ON DUPLICATE KEY UPDATE venue_name = VALUES(venue_name);

-- 4. Cơ cấu các hạng vé cho từng suất diễn
INSERT INTO ticket_types (id, showing_id, type_name, price_vnd, capacity) VALUES
-- Suất diễn SHW-CONCERT-HCM (showing_id = 1)
(1, 1, 'Standard', 350000, 500),
(2, 1, 'VIP', 750000, 150),
(3, 1, 'VVIP Front Row', 1500000, 50),

-- Suất diễn SHW-CONCERT-HN (showing_id = 2)
(4, 2, 'Phổ Thông', 400000, 800),
(5, 2, 'VIP', 900000, 200),

-- Suất diễn SHW-THEATER-HCM (showing_id = 3)
(6, 3, 'Vé Sinh Viên', 120000, 100),
(7, 3, 'Vé Tiêu Chuẩn', 250000, 200)
ON DUPLICATE KEY UPDATE price_vnd = VALUES(price_vnd);

