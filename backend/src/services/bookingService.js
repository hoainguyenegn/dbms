import { randomBytes, randomUUID } from 'node:crypto';
import { BookingError, assertReservationCanBeConfirmed, canCancelBooking } from './bookingPolicy.js';

const bookingSelect = `
  SELECT b.id, b.booking_code, b.status,
         DATE_FORMAT(b.booked_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS booked_at,
         DATE_FORMAT(b.cancelled_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS cancelled_at,
         e.title AS event_title, s.showing_code, s.venue_name, s.city_code,
         DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS starts_at,
         (SELECT COALESCE(SUM(bi.quantity), 0) FROM booking_items bi WHERE bi.booking_id = b.id) AS ticket_count,
         (SELECT COALESCE(SUM(bi.subtotal_vnd), 0) FROM booking_items bi WHERE bi.booking_id = b.id) AS total_amount_vnd
  FROM bookings b
  JOIN event_showings s ON s.id = b.showing_id
  JOIN events e ON e.id = s.event_id
`;

function makeBookingCode() {
  return `BK-${randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`;
}

function makeTicketCode() {
  return `TCK-${randomBytes(8).toString('hex').toUpperCase()}`;
}

async function readBooking(pool, bookingId, userId) {
  const [rows] = await pool.execute(
    `${bookingSelect} WHERE b.id = ? AND b.user_id = ?`,
    [bookingId, userId],
  );
  const booking = rows[0];
  if (!booking) return null;

  const [items] = await pool.execute(
    `SELECT bi.ticket_type_id, tt.type_name, bi.quantity, bi.unit_price_vnd, bi.subtotal_vnd
       FROM booking_items bi
       JOIN ticket_types tt ON tt.id = bi.ticket_type_id
      WHERE bi.booking_id = ?
      ORDER BY bi.ticket_type_id`,
    [bookingId],
  );
  const [tickets] = await pool.execute(
    `SELECT t.ticket_code, t.ticket_type_id, t.ordinal, tt.type_name
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.booking_id = ?
      ORDER BY t.ticket_type_id, t.ordinal`,
    [bookingId],
  );

  return {
    id: booking.id,
    bookingCode: booking.booking_code,
    status: booking.status,
    bookedAt: booking.booked_at,
    cancelledAt: booking.cancelled_at,
    event: { title: booking.event_title },
    showing: {
      code: booking.showing_code,
      venue: booking.venue_name,
      city: booking.city_code,
      startsAt: booking.starts_at,
    },
    ticketCount: Number(booking.ticket_count),
    totalAmountVnd: Number(booking.total_amount_vnd),
    items: items.map((item) => ({
      ticketTypeId: item.ticket_type_id,
      ticketType: item.type_name,
      quantity: item.quantity,
      unitPriceVnd: Number(item.unit_price_vnd),
      subtotalVnd: Number(item.subtotal_vnd),
    })),
    tickets: tickets.map((ticket) => ({
      code: ticket.ticket_code,
      ticketTypeId: ticket.ticket_type_id,
      ticketType: ticket.type_name,
      ordinal: ticket.ordinal,
      valid: booking.status === 'CONFIRMED',
    })),
  };
}

export async function confirmReservation(pool, reservationId, userId) {
  const connection = await pool.getConnection();
  let transactionOpen = false;

  try {
    await connection.beginTransaction();
    transactionOpen = true;

    const [reservationRows] = await connection.execute(
      `SELECT r.id, r.user_id, r.showing_id, r.status,
              DATE_FORMAT(r.expires_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS expires_at,
              e.status AS event_status,
              DATE_FORMAT(s.sales_start_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS sales_start_at,
              DATE_FORMAT(s.sales_end_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS sales_end_at
         FROM reservations r
         JOIN event_showings s ON s.id = r.showing_id
         JOIN events e ON e.id = s.event_id
        WHERE r.id = ? AND r.user_id = ?
        FOR UPDATE`,
      [reservationId, userId],
    );
    const reservation = reservationRows[0];
    if (!reservation) {
      throw new BookingError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy phiếu giữ vé.');
    }

    const [existingRows] = await connection.execute(
      'SELECT id FROM bookings WHERE reservation_id = ? AND user_id = ? FOR UPDATE',
      [reservationId, userId],
    );
    if (existingRows[0]) {
      await connection.commit();
      transactionOpen = false;
      return { booking: await readBooking(pool, existingRows[0].id, userId), created: false };
    }

    const [[clock]] = await connection.query(
      "SELECT DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ') AS now_utc",
    );
    assertReservationCanBeConfirmed(reservation, clock.now_utc);

    const [items] = await connection.execute(
      `SELECT ri.ticket_type_id, ri.showing_id, ri.quantity, tt.type_name, tt.price_vnd
         FROM reservation_items ri
         JOIN ticket_types tt ON tt.id = ri.ticket_type_id AND tt.showing_id = ri.showing_id
        WHERE ri.reservation_id = ?
        ORDER BY ri.ticket_type_id
        FOR UPDATE`,
      [reservationId],
    );
    const totalQuantity = items.reduce((total, item) => total + Number(item.quantity), 0);
    if (items.length === 0 || items.some((item) => Number(item.showing_id) !== Number(reservation.showing_id))) {
      throw new BookingError(409, 'RESERVATION_ITEMS_INVALID', 'Chi tiết phiếu giữ vé không hợp lệ.');
    }
    if (totalQuantity < 1 || totalQuantity > 6) {
      throw new BookingError(409, 'RESERVATION_LIMIT_EXCEEDED', 'Mỗi đơn chỉ được gồm từ 1 đến 6 vé.');
    }

    const [consumeResult] = await connection.execute(
      `UPDATE reservations
          SET status = 'CONSUMED', updated_at = UTC_TIMESTAMP(3)
        WHERE id = ? AND user_id = ? AND status = 'ACTIVE' AND expires_at > UTC_TIMESTAMP(3)`,
      [reservationId, userId],
    );
    if (consumeResult.affectedRows !== 1) {
      throw new BookingError(409, 'RESERVATION_NOT_ACTIVE', 'Phiếu giữ vé vừa hết hiệu lực hoặc đã được xử lý.');
    }

    const [bookingResult] = await connection.execute(
      `INSERT INTO bookings (booking_code, reservation_id, user_id, showing_id, status, email_status)
       VALUES (?, ?, ?, ?, 'CONFIRMED', 'PENDING')`,
      [makeBookingCode(), reservationId, userId, reservation.showing_id],
    );
    const bookingId = bookingResult.insertId;

    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.price_vnd);
      await connection.execute(
        `INSERT INTO booking_items (booking_id, ticket_type_id, showing_id, unit_price_vnd, quantity, subtotal_vnd)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookingId, item.ticket_type_id, reservation.showing_id, unitPrice, quantity, unitPrice * quantity],
      );

      for (let ordinal = 1; ordinal <= quantity; ordinal += 1) {
        await connection.execute(
          'INSERT INTO tickets (ticket_code, booking_id, ticket_type_id, ordinal) VALUES (?, ?, ?, ?)',
          [makeTicketCode(), bookingId, item.ticket_type_id, ordinal],
        );
      }
    }

    await connection.commit();
    transactionOpen = false;
    return { booking: await readBooking(pool, bookingId, userId), created: true };
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listBookings(pool, userId, page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  const [[countRow], [rows]] = await Promise.all([
    pool.execute('SELECT COUNT(*) AS total FROM bookings WHERE user_id = ?', [userId]),
    pool.execute(
      `${bookingSelect} WHERE b.user_id = ? ORDER BY b.booked_at DESC, b.id DESC LIMIT ? OFFSET ?`,
      [userId, pageSize, offset],
    ),
  ]);

  return {
    items: rows.map((booking) => ({
      id: booking.id,
      bookingCode: booking.booking_code,
      status: booking.status,
      bookedAt: booking.booked_at,
      cancelledAt: booking.cancelled_at,
      event: { title: booking.event_title },
      showing: {
        code: booking.showing_code,
        venue: booking.venue_name,
        city: booking.city_code,
        startsAt: booking.starts_at,
      },
      ticketCount: Number(booking.ticket_count),
      totalAmountVnd: Number(booking.total_amount_vnd),
    })),
    page,
    pageSize,
    total: Number(countRow[0].total),
  };
}

export async function getBooking(pool, bookingCode, userId) {
  const [rows] = await pool.execute(
    'SELECT id FROM bookings WHERE booking_code = ? AND user_id = ?',
    [bookingCode, userId],
  );
  if (!rows[0]) {
    throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }
  return readBooking(pool, rows[0].id, userId);
}

export async function cancelBooking(pool, bookingCode, userId) {
  const connection = await pool.getConnection();
  let transactionOpen = false;

  try {
    await connection.beginTransaction();
    transactionOpen = true;
    const [rows] = await connection.execute(
      `SELECT b.id, b.status,
              DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS starts_at
         FROM bookings b
         JOIN event_showings s ON s.id = b.showing_id
        WHERE b.booking_code = ? AND b.user_id = ?
        FOR UPDATE`,
      [bookingCode, userId],
    );
    const booking = rows[0];
    if (!booking) {
      throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    }

    const [[clock]] = await connection.query(
      "SELECT DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ') AS now_utc",
    );
    if (canCancelBooking(booking, clock.now_utc)) {
      await connection.execute(
        `UPDATE bookings
            SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(3)
          WHERE id = ? AND status = 'CONFIRMED'`,
        [booking.id],
      );
    }

    await connection.commit();
    transactionOpen = false;
    return readBooking(pool, booking.id, userId);
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}