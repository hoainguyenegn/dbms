import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BookingError } from './bookingPolicy.js';
import {
  calculateReservationExpiry,
  normalizeReservationInput,
  sameReservationPayload,
} from './reservationPolicy.js';

const reserveScript = readFileSync(
  fileURLToPath(new URL('../../../database/redis/lua/reserve.lua', import.meta.url)),
  'utf8',
);
const releaseScript = readFileSync(
  fileURLToPath(new URL('../../../database/redis/lua/release.lua', import.meta.url)),
  'utf8',
);

function reservationCacheKey(reservationId) {
  return `eventbox:reservation:${reservationId}`;
}

function reservationFromRows(row, items) {
  const expiresAt = row.expires_at;
  const secondsRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return {
    id: row.id,
    status: row.status,
    showingId: Number(row.showing_id),
    requestKey: row.request_key,
    expiresAt,
    secondsRemaining,
    event: row.event_title ? { title: row.event_title } : undefined,
    showing: row.showing_code ? {
      code: row.showing_code,
      venue: row.venue_name,
      city: row.city_code,
      startsAt: row.starts_at,
    } : undefined,
    totalQuantity: items.reduce((total, item) => total + Number(item.quantity), 0),
    totalAmountVnd: items.reduce((total, item) => total + Number(item.quantity) * Number(item.price_vnd), 0),
    items: items.map((item) => ({
      ticketTypeId: Number(item.ticket_type_id),
      ticketType: item.type_name,
      quantity: Number(item.quantity),
      unitPriceVnd: Number(item.price_vnd),
      subtotalVnd: Number(item.price_vnd) * Number(item.quantity),
    })),
  };
}

async function readReservation(pool, reservationId, userId) {
  await pool.execute(
    `UPDATE reservations
        SET status = 'EXPIRED', updated_at = UTC_TIMESTAMP(3)
      WHERE id = ? AND user_id = ? AND status = 'ACTIVE' AND expires_at <= UTC_TIMESTAMP(3)`,
    [reservationId, userId],
  );
  const [rows] = await pool.execute(
    `SELECT r.id, r.user_id, r.showing_id, r.request_key, r.status,
            DATE_FORMAT(r.expires_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS expires_at,
            e.title AS event_title, s.showing_code, s.venue_name, s.city_code,
            DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS starts_at
       FROM reservations r
       JOIN event_showings s ON s.id = r.showing_id
       JOIN events e ON e.id = s.event_id
      WHERE r.id = ? AND r.user_id = ?`,
    [reservationId, userId],
  );
  if (!rows[0]) throw new BookingError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy phiếu giữ vé.');
  const [items] = await pool.execute(
    `SELECT ri.ticket_type_id, ri.quantity, tt.type_name, tt.price_vnd
       FROM reservation_items ri
       JOIN ticket_types tt ON tt.id = ri.ticket_type_id AND tt.showing_id = ri.showing_id
      WHERE ri.reservation_id = ?
      ORDER BY ri.ticket_type_id`,
    [reservationId],
  );
  return reservationFromRows(rows[0], items);
}

async function cacheReservation(redisClient, reservation, userId, requestKey, capacityRows, items) {
  if (!redisClient?.isReady) return false;
  const ttlMs = Math.max(1, new Date(reservation.expiresAt).getTime() - Date.now());
  const argumentsList = [
    reservation.id,
    String(userId),
    String(reservation.showingId),
    requestKey,
    String(ttlMs),
    String(items.length),
  ];
  for (const item of items) {
    const row = capacityRows.get(item.ticketTypeId);
    argumentsList.push(
      String(item.ticketTypeId),
      String(item.quantity),
      String(row.capacity),
      String(row.sold),
      String(row.held),
    );
  }
  argumentsList.push(reservation.expiresAt, JSON.stringify(reservation.items));

  try {
    const result = await redisClient.eval(reserveScript, {
      keys: [reservationCacheKey(reservation.id)],
      arguments: argumentsList,
    });
    return Number(result) === 1;
  } catch (error) {
    console.warn('Reservation Redis cache unavailable:', error.message);
    return false;
  }
}

export async function clearReservationCache(redisClient, reservationId, userId) {
  if (!redisClient?.isReady) return false;
  try {
    await redisClient.eval(releaseScript, {
      keys: [reservationCacheKey(reservationId)],
      arguments: [String(userId)],
    });
    return true;
  } catch (error) {
    console.warn('Reservation Redis cache cleanup failed:', error.message);
    return false;
  }
}

export async function listOnSaleShowings(pool) {
  const [rows] = await pool.execute(
    `SELECT s.id AS showing_id, s.showing_code, s.venue_name, s.city_code,
            DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS starts_at,
            e.title AS event_title,
            tt.id AS ticket_type_id, tt.type_name, tt.price_vnd, tt.capacity,
            GREATEST(0, tt.capacity
              - (SELECT COALESCE(SUM(bi.quantity), 0)
                   FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
                  WHERE bi.ticket_type_id = tt.id AND b.status = 'CONFIRMED')
              - (SELECT COALESCE(SUM(ri.quantity), 0)
                   FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id
                  WHERE ri.ticket_type_id = tt.id AND r.status = 'ACTIVE' AND r.expires_at > UTC_TIMESTAMP(3))
            ) AS available
       FROM event_showings s
       JOIN events e ON e.id = s.event_id
       JOIN ticket_types tt ON tt.showing_id = s.id
      WHERE e.status = 'PUBLISHED'
        AND s.sales_start_at <= UTC_TIMESTAMP(3)
        AND s.sales_end_at > UTC_TIMESTAMP(3)
        AND s.starts_at > UTC_TIMESTAMP(3)
      ORDER BY s.starts_at, s.id, tt.id`,
  );

  const showings = new Map();
  for (const row of rows) {
    const showingId = Number(row.showing_id);
    if (!showings.has(showingId)) {
      showings.set(showingId, {
        id: showingId,
        code: row.showing_code,
        eventTitle: row.event_title,
        venue: row.venue_name,
        city: row.city_code,
        startsAt: row.starts_at,
        ticketTypes: [],
      });
    }
    showings.get(showingId).ticketTypes.push({
      id: Number(row.ticket_type_id),
      name: row.type_name,
      priceVnd: Number(row.price_vnd),
      available: Number(row.available),
    });
  }
  return [...showings.values()];
}

export async function createReservation(pool, redisClient, input, userId) {
  const request = normalizeReservationInput(input);
  const connection = await pool.getConnection();
  let transactionOpen = false;
  let response;
  let cacheRows;

  try {
    await connection.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    transactionOpen = true;
    await connection.execute('SELECT e.id FROM events e WHERE e.id = (SELECT event_id FROM event_showings WHERE id = ?) FOR UPDATE', [request.showingId]);
    const [showingRows] = await connection.execute(
          `SELECT s.id,
            DATE_FORMAT(s.sales_start_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS sales_start_at,
            DATE_FORMAT(s.sales_end_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS sales_end_at,
            DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS starts_at,
              e.status AS event_status,
            DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ') AS now_utc
         FROM event_showings s
         JOIN events e ON e.id = s.event_id
        WHERE s.id = ?
        FOR UPDATE`,
      [request.showingId],
    );
    const showing = showingRows[0];
    if (!showing) throw new BookingError(404, 'SHOWING_NOT_FOUND', 'Không tìm thấy suất diễn.');

    const [existingRows] = await connection.execute(
      `SELECT id, showing_id, request_key, status,
              DATE_FORMAT(expires_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS expires_at
         FROM reservations
        WHERE user_id = ? AND request_key = ?
        FOR UPDATE`,
      [userId, request.requestKey],
    );
    if (existingRows[0]) {
      const existing = existingRows[0];
      const [existingItems] = await connection.execute(
        'SELECT ticket_type_id, quantity FROM reservation_items WHERE reservation_id = ? ORDER BY ticket_type_id',
        [existing.id],
      );
      if (Number(existing.showing_id) !== request.showingId
        || !sameReservationPayload(existingItems, request.items)) {
        throw new BookingError(409, 'REQUEST_KEY_CONFLICT', 'request_key đã được dùng với nội dung khác.');
      }
      await connection.commit();
      transactionOpen = false;
      return { reservation: await readReservation(pool, existing.id, userId), created: false };
    }

    const now = new Date(showing.now_utc);
    const salesStart = new Date(showing.sales_start_at);
    const salesEnd = new Date(showing.sales_end_at);
    if (showing.event_status !== 'PUBLISHED'
      || salesStart.getTime() > now.getTime()
      || salesEnd.getTime() <= now.getTime()
      || new Date(showing.starts_at).getTime() <= now.getTime()) {
      throw new BookingError(409, 'SHOWING_NOT_ON_SALE', 'Suất diễn hiện không trong thời gian bán vé.');
    }

    await connection.execute(
      `UPDATE reservations
          SET status = 'EXPIRED', updated_at = UTC_TIMESTAMP(3)
        WHERE user_id = ? AND showing_id = ? AND status = 'ACTIVE'
          AND expires_at <= UTC_TIMESTAMP(3)`,
      [userId, request.showingId],
    );
    const [activeRows] = await connection.execute(
      `SELECT id FROM reservations
        WHERE user_id = ? AND showing_id = ? AND status = 'ACTIVE'
          AND expires_at > UTC_TIMESTAMP(3)
        FOR UPDATE`,
      [userId, request.showingId],
    );
    if (activeRows.length) {
      throw new BookingError(409, 'ACTIVE_RESERVATION_EXISTS', 'Bạn đang có phiếu giữ vé còn hiệu lực cho suất diễn này.');
    }

    const placeholders = request.items.map(() => '?').join(', ');
    const ticketTypeIds = request.items.map((item) => item.ticketTypeId);
    const [ticketRows] = await connection.execute(
      `SELECT tt.id, tt.type_name, tt.price_vnd, tt.capacity,
              (SELECT COALESCE(SUM(bi.quantity), 0)
                 FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
                WHERE bi.ticket_type_id = tt.id AND b.status = 'CONFIRMED') AS sold,
              (SELECT COALESCE(SUM(ri.quantity), 0)
                 FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id
                WHERE ri.ticket_type_id = tt.id AND r.status = 'ACTIVE'
                  AND r.expires_at > UTC_TIMESTAMP(3)) AS held
         FROM ticket_types tt
        WHERE tt.showing_id = ? AND tt.id IN (${placeholders})
        ORDER BY tt.id
        FOR UPDATE`,
      [request.showingId, ...ticketTypeIds],
    );
    if (ticketRows.length !== request.items.length) {
      throw new BookingError(409, 'TICKET_TYPE_NOT_IN_SHOWING', 'Một hoặc nhiều loại vé không thuộc suất diễn đã chọn.');
    }
    cacheRows = new Map(ticketRows.map((row) => [Number(row.id), {
      capacity: Number(row.capacity),
      sold: Number(row.sold),
      held: Number(row.held),
    }]));
    for (const item of request.items) {
      const row = cacheRows.get(item.ticketTypeId);
      if (item.quantity > row.capacity - row.sold - row.held) {
        throw new BookingError(409, 'INSUFFICIENT_TICKETS', 'Không đủ vé khả dụng cho lựa chọn này.');
      }
    }

    const reservationId = randomUUID();
    const [expiryRows] = await connection.execute(
      `SELECT DATE_FORMAT(
                LEAST(DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 300 SECOND), ?),
                '%Y-%m-%dT%H:%i:%s.%fZ'
              ) AS expires_at`,
      [showing.sales_end_at.replace('T', ' ').replace('Z', '').slice(0, 23)],
    );
    const expiresAt = expiryRows[0].expires_at;
    await connection.execute(
      `INSERT INTO reservations (id, user_id, showing_id, request_key, status, expires_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
      [reservationId, userId, request.showingId, request.requestKey, expiresAt.replace('T', ' ').replace('Z', '').slice(0, 23)],
    );
    for (const item of request.items) {
      await connection.execute(
        `INSERT INTO reservation_items (reservation_id, ticket_type_id, showing_id, quantity)
         VALUES (?, ?, ?, ?)`,
        [reservationId, item.ticketTypeId, request.showingId, item.quantity],
      );
    }
    await connection.commit();
    transactionOpen = false;
    response = await readReservation(pool, reservationId, userId);
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new BookingError(409, 'REQUEST_KEY_CONFLICT', 'request_key đã được dùng với một yêu cầu giữ vé khác.');
    }
    throw error;
  } finally {
    connection.release();
  }

  const redisCached = await cacheReservation(
    redisClient,
    response,
    userId,
    request.requestKey,
    cacheRows,
    request.items,
  );
  return { reservation: response, created: true, redisCached };
}

export async function getReservation(pool, reservationId, userId) {
  return readReservation(pool, reservationId, userId);
}

export async function releaseReservation(pool, redisClient, reservationId, userId) {
  const [lookupRows] = await pool.execute(
    'SELECT showing_id FROM reservations WHERE id = ? AND user_id = ?',
    [reservationId, userId],
  );
  if (!lookupRows[0]) throw new BookingError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy phiếu giữ vé.');

  const connection = await pool.getConnection();
  let transactionOpen = false;
  let status;
  try {
    await connection.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    transactionOpen = true;
    await connection.execute('SELECT e.id FROM events e WHERE e.id = (SELECT event_id FROM event_showings WHERE id = ?) FOR UPDATE', [lookupRows[0].showing_id]);
    await connection.execute('SELECT id FROM event_showings WHERE id = ? FOR UPDATE', [lookupRows[0].showing_id]);
    const [rows] = await connection.execute(
      `SELECT status, expires_at <= UTC_TIMESTAMP(3) AS is_expired
         FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE`,
      [reservationId, userId],
    );
    if (!rows[0]) throw new BookingError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy phiếu giữ vé.');
    status = rows[0].status;
    if (status === 'ACTIVE') {
      status = rows[0].is_expired ? 'EXPIRED' : 'RELEASED';
      await connection.execute(
        `UPDATE reservations SET status = ?, updated_at = UTC_TIMESTAMP(3)
          WHERE id = ? AND status = 'ACTIVE'`,
        [status, reservationId],
      );
    } else if (status === 'CONSUMED') {
      throw new BookingError(409, 'RESERVATION_CONSUMED', 'Phiếu giữ đã được chuyển thành đơn đặt vé.');
    }
    await connection.commit();
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await clearReservationCache(redisClient, reservationId, userId);
  return readReservation(pool, reservationId, userId);
}