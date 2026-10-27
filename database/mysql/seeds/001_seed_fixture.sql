START TRANSACTION;

INSERT INTO users (username, password_hash, full_name, email, role)
VALUES
  ('user01', '$2b$10$j1okLTaVwyOnGhtdkO/nX.XK95na8w6iCAqcRXqBUg8OempOPDp2C', 'Nguyen Minh Anh', 'user01@example.test', 'USER'),
  ('manager01', '$2b$10$TBOoPqXem.WqOlUGD7twQOBDbPl0seTh66ikmRUocjBVbZksGA4XW', 'EventBox Manager', 'manager01@example.test', 'MANAGER')
AS new_user
ON DUPLICATE KEY UPDATE
  password_hash = new_user.password_hash,
  full_name = new_user.full_name,
  email = new_user.email,
  role = new_user.role;

SET @user_id = (SELECT id FROM users WHERE username = 'user01');
SET @event_id = NULL;
SET @active_reservation_id = 'f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73';
SET @active_booking_id = (
  SELECT id FROM bookings
  WHERE BINARY reservation_id = BINARY @active_reservation_id
);

DELETE FROM tickets WHERE booking_id = @active_booking_id;
DELETE FROM booking_items WHERE booking_id = @active_booking_id;
DELETE FROM bookings WHERE id = @active_booking_id;

INSERT INTO events (event_code, title, category, status, description)
VALUES (
  'EVT-DEMO-TRANSACTION',
  'EventBox Demo: Đêm nhạc mùa thu',
  'MUSIC',
  'PUBLISHED',
  'Sự kiện fixture để thử xác nhận, hủy và tra cứu đơn vé.'
)
AS new_event
ON DUPLICATE KEY UPDATE
  title = new_event.title,
  category = new_event.category,
  status = new_event.status,
  description = new_event.description;

SET @event_id = (SELECT id FROM events WHERE event_code = 'EVT-DEMO-TRANSACTION');

INSERT INTO event_showings (
  event_id, showing_code, venue_name, city_code,
  sales_start_at, sales_end_at, starts_at, ends_at
)
VALUES (
  @event_id,
  'SHW-DEMO-TRANSACTION',
  'Nhà hát Thành phố',
  'HCM',
  DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY),
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 DAY),
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 8 DAY),
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 8 DAY) + INTERVAL 3 HOUR
)
AS new_showing
ON DUPLICATE KEY UPDATE
  event_id = new_showing.event_id,
  venue_name = new_showing.venue_name,
  city_code = new_showing.city_code,
  sales_start_at = new_showing.sales_start_at,
  sales_end_at = new_showing.sales_end_at,
  starts_at = new_showing.starts_at,
  ends_at = new_showing.ends_at;

SET @showing_id = (SELECT id FROM event_showings WHERE showing_code = 'SHW-DEMO-TRANSACTION');

INSERT INTO ticket_types (showing_id, type_name, price_vnd, capacity)
VALUES
  (@showing_id, 'Standard', 350000, 100),
  (@showing_id, 'VIP', 750000, 30)
AS new_ticket_type
ON DUPLICATE KEY UPDATE
  price_vnd = new_ticket_type.price_vnd,
  capacity = new_ticket_type.capacity;

SET @standard_ticket_type_id = (
  SELECT id FROM ticket_types WHERE showing_id = @showing_id AND type_name = 'Standard'
);
SET @vip_ticket_type_id = (
  SELECT id FROM ticket_types WHERE showing_id = @showing_id AND type_name = 'VIP'
);

INSERT INTO reservations (
  id, user_id, showing_id, request_key, status, expires_at
)
VALUES
  (
    'f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73',
    @user_id,
    @showing_id,
    'a6cf87e0-9a95-4dae-86f6-3f57cde13c37',
    'ACTIVE',
    DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE)
  ),
  (
    'a4782b88-09ac-4bfa-a85a-62204357c762',
    @user_id,
    @showing_id,
    'f1dc1a48-796f-45ac-ae0a-61f79df09391',
    'CONSUMED',
    DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)
  ),
  (
    '5948b739-f1c8-423d-8acd-42ca4c208386',
    @user_id,
    @showing_id,
    'e36de4be-e578-44cc-96bd-4f815254c018',
    'CONSUMED',
    DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)
  )
AS new_reservation
ON DUPLICATE KEY UPDATE
  user_id = new_reservation.user_id,
  showing_id = new_reservation.showing_id,
  status = new_reservation.status,
  expires_at = new_reservation.expires_at;

INSERT INTO reservation_items (reservation_id, ticket_type_id, showing_id, quantity)
VALUES
  ('f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73', @standard_ticket_type_id, @showing_id, 2),
  ('a4782b88-09ac-4bfa-a85a-62204357c762', @standard_ticket_type_id, @showing_id, 2),
  ('5948b739-f1c8-423d-8acd-42ca4c208386', @vip_ticket_type_id, @showing_id, 1)
AS new_reservation_item
ON DUPLICATE KEY UPDATE
  showing_id = new_reservation_item.showing_id,
  quantity = new_reservation_item.quantity;

INSERT INTO bookings (
  booking_code, reservation_id, user_id, showing_id, status, email_status, booked_at, cancelled_at
)
VALUES
  (
    'BK-DEMO-CONFIRMED',
    'a4782b88-09ac-4bfa-a85a-62204357c762',
    @user_id,
    @showing_id,
    'CONFIRMED',
    'PENDING',
    UTC_TIMESTAMP(3),
    NULL
  ),
  (
    'BK-DEMO-CANCELLED',
    '5948b739-f1c8-423d-8acd-42ca4c208386',
    @user_id,
    @showing_id,
    'CANCELLED',
    'PENDING',
    UTC_TIMESTAMP(3),
    UTC_TIMESTAMP(3)
  )
AS new_booking
ON DUPLICATE KEY UPDATE
  user_id = new_booking.user_id,
  showing_id = new_booking.showing_id,
  status = new_booking.status,
  email_status = new_booking.email_status,
  booked_at = new_booking.booked_at,
  cancelled_at = new_booking.cancelled_at;

SET @confirmed_booking_id = (
  SELECT id FROM bookings WHERE booking_code = 'BK-DEMO-CONFIRMED'
);
SET @cancelled_booking_id = (
  SELECT id FROM bookings WHERE booking_code = 'BK-DEMO-CANCELLED'
);

INSERT INTO booking_items (
  booking_id, ticket_type_id, showing_id, unit_price_vnd, quantity, subtotal_vnd
)
VALUES
  (@confirmed_booking_id, @standard_ticket_type_id, @showing_id, 350000, 2, 700000),
  (@cancelled_booking_id, @vip_ticket_type_id, @showing_id, 750000, 1, 750000)
AS new_booking_item
ON DUPLICATE KEY UPDATE
  showing_id = new_booking_item.showing_id,
  unit_price_vnd = new_booking_item.unit_price_vnd,
  quantity = new_booking_item.quantity,
  subtotal_vnd = new_booking_item.subtotal_vnd;

INSERT INTO tickets (ticket_code, booking_id, ticket_type_id, ordinal)
VALUES
  ('TCK-DEMO-CONF-001', @confirmed_booking_id, @standard_ticket_type_id, 1),
  ('TCK-DEMO-CONF-002', @confirmed_booking_id, @standard_ticket_type_id, 2),
  ('TCK-DEMO-CANCEL-001', @cancelled_booking_id, @vip_ticket_type_id, 1)
AS new_ticket
ON DUPLICATE KEY UPDATE
  booking_id = new_ticket.booking_id,
  ticket_type_id = new_ticket.ticket_type_id,
  ordinal = new_ticket.ordinal;

COMMIT;

SELECT username, email, role
FROM users
WHERE username IN ('user01', 'manager01')
ORDER BY role;

SELECT id AS active_reservation_id, expires_at
FROM reservations
WHERE id = 'f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73';

SELECT booking_code, status
FROM bookings
WHERE booking_code IN ('BK-DEMO-CONFIRMED', 'BK-DEMO-CANCELLED')
ORDER BY booking_code;