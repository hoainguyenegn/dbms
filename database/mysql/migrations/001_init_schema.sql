CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'USER',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_role CHECK (role IN ('USER', 'MANAGER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_code VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
  description TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_events_code (event_code),
  KEY idx_events_status_cat (status, category),
  CONSTRAINT chk_events_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_showings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id INT UNSIGNED NOT NULL,
  showing_code VARCHAR(32) NOT NULL,
  venue_name VARCHAR(150) NOT NULL,
  city_code VARCHAR(10) NOT NULL,
  sales_start_at DATETIME(3) NOT NULL,
  sales_end_at DATETIME(3) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_showings_code (showing_code),
  UNIQUE KEY uq_showings_id_event (id, event_id),
  KEY idx_showings_city (city_code),
  KEY idx_showings_sales_window (sales_start_at, sales_end_at),
  CONSTRAINT fk_showings_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE RESTRICT,
  CONSTRAINT chk_showings_schedule CHECK (
    sales_start_at < sales_end_at AND sales_end_at <= starts_at AND starts_at < ends_at
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  showing_id INT UNSIGNED NOT NULL,
  type_name VARCHAR(50) NOT NULL,
  price_vnd INT UNSIGNED NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_types_showing_name (showing_id, type_name),
  UNIQUE KEY uq_ticket_types_id_showing (id, showing_id),
  KEY idx_ticket_types_showing (showing_id),
  CONSTRAINT fk_ticket_types_showing FOREIGN KEY (showing_id) REFERENCES event_showings (id) ON DELETE RESTRICT,
  CONSTRAINT chk_ticket_types_price CHECK (price_vnd <= 1000000000),
  CONSTRAINT chk_ticket_types_capacity CHECK (capacity BETWEEN 1 AND 100000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservations (
  id CHAR(36) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  showing_id INT UNSIGNED NOT NULL,
  request_key CHAR(36) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reservations_user_request (user_id, request_key),
  UNIQUE KEY uq_reservations_id_showing (id, showing_id),
  KEY idx_reservations_showing_status_expiry (showing_id, status, expires_at),
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_showing FOREIGN KEY (showing_id) REFERENCES event_showings (id) ON DELETE RESTRICT,
  CONSTRAINT chk_reservations_status CHECK (status IN ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservation_items (
  reservation_id CHAR(36) NOT NULL,
  ticket_type_id INT UNSIGNED NOT NULL,
  showing_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (reservation_id, ticket_type_id),
  KEY idx_reservation_items_type_showing (ticket_type_id, showing_id),
  CONSTRAINT fk_reservation_items_reservation_showing
    FOREIGN KEY (reservation_id, showing_id) REFERENCES reservations (id, showing_id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservation_items_type_showing
    FOREIGN KEY (ticket_type_id, showing_id) REFERENCES ticket_types (id, showing_id) ON DELETE RESTRICT,
  CONSTRAINT chk_reservation_items_quantity CHECK (quantity BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_code VARCHAR(32) NOT NULL,
  reservation_id CHAR(36) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  showing_id INT UNSIGNED NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'CONFIRMED',
  email_status VARCHAR(15) NOT NULL DEFAULT 'PENDING',
  email_sent_at DATETIME(3) NULL,
  booked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cancelled_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_code (booking_code),
  UNIQUE KEY uq_bookings_reservation (reservation_id),
  UNIQUE KEY uq_bookings_id_showing (id, showing_id),
  KEY idx_bookings_user_status (user_id, status),
  KEY idx_bookings_showing_status (showing_id, status),
  KEY idx_bookings_status_date (status, booked_at),
  CONSTRAINT fk_bookings_reservation_showing
    FOREIGN KEY (reservation_id, showing_id) REFERENCES reservations (id, showing_id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_showing FOREIGN KEY (showing_id) REFERENCES event_showings (id) ON DELETE RESTRICT,
  CONSTRAINT chk_bookings_status CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  CONSTRAINT chk_bookings_email_status CHECK (email_status IN ('PENDING', 'SENT', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_items (
  booking_id INT UNSIGNED NOT NULL,
  ticket_type_id INT UNSIGNED NOT NULL,
  showing_id INT UNSIGNED NOT NULL,
  unit_price_vnd INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  subtotal_vnd BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (booking_id, ticket_type_id),
  KEY idx_booking_items_showing (showing_id),
  KEY idx_booking_items_type (ticket_type_id),
  CONSTRAINT fk_booking_items_booking_showing
    FOREIGN KEY (booking_id, showing_id) REFERENCES bookings (id, showing_id) ON DELETE RESTRICT,
  CONSTRAINT fk_booking_items_type_showing
    FOREIGN KEY (ticket_type_id, showing_id) REFERENCES ticket_types (id, showing_id) ON DELETE RESTRICT,
  CONSTRAINT chk_booking_items_price CHECK (unit_price_vnd >= 0),
  CONSTRAINT chk_booking_items_quantity CHECK (quantity >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tickets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_code VARCHAR(32) NOT NULL,
  booking_id INT UNSIGNED NOT NULL,
  ticket_type_id INT UNSIGNED NOT NULL,
  ordinal INT UNSIGNED NOT NULL,
  issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_code (ticket_code),
  UNIQUE KEY uq_tickets_booking_type_ordinal (booking_id, ticket_type_id, ordinal),
  KEY idx_tickets_booking (booking_id),
  CONSTRAINT fk_tickets_booking_item FOREIGN KEY (booking_id, ticket_type_id)
    REFERENCES booking_items (booking_id, ticket_type_id) ON DELETE RESTRICT,
  CONSTRAINT chk_tickets_ordinal CHECK (ordinal >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;