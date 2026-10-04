import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelBooking, confirmReservation } from '../src/services/bookingService.js';

const reservation = {
  id: 'f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73',
  user_id: 7,
  showing_id: 12,
  status: 'ACTIVE',
  expires_at: '2026-10-04T12:05:00.000000Z',
  event_status: 'PUBLISHED',
  sales_start_at: '2026-10-01T00:00:00.000000Z',
  sales_end_at: '2026-10-05T00:00:00.000000Z',
};

function createPool({ existingBooking = false, failOnTicket = false } = {}) {
  const calls = { commits: 0, rollbacks: 0, releases: 0, bookingItems: 0, tickets: 0, updates: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() { calls.commits += 1; },
    async rollback() { calls.rollbacks += 1; },
    release() { calls.releases += 1; },
    async query() {
      return [[{ now_utc: '2026-10-04T12:00:00.000000Z' }], []];
    },
    async execute(sql) {
      if (sql.includes('FROM reservations r')) return [[reservation], []];
      if (sql.includes('FROM bookings WHERE reservation_id')) {
        return [existingBooking ? [{ id: 41 }] : [], []];
      }
      if (sql.includes('FROM reservation_items ri')) {
        return [[{ ticket_type_id: 18, showing_id: 12, quantity: 2, type_name: 'Standard', price_vnd: 150000 }], []];
      }
      if (sql.includes('UPDATE reservations')) {
        calls.updates += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('INSERT INTO bookings')) return [{ insertId: 41 }, []];
      if (sql.includes('INSERT INTO booking_items')) {
        calls.bookingItems += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('INSERT INTO tickets')) {
        calls.tickets += 1;
        if (failOnTicket) throw new Error('simulated ticket insert failure');
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected connection query: ${sql}`);
    },
  };

  const pool = {
    getConnection: async () => connection,
    async execute(sql) {
      if (sql.includes('JOIN event_showings')) {
        return [[{
          id: 41,
          booking_code: 'BK-TEST',
          status: 'CONFIRMED',
          booked_at: '2026-10-04T12:00:00.000000Z',
          cancelled_at: null,
          event_title: 'Test Event',
          showing_code: 'SHOW-1',
          venue_name: 'Hall A',
          city_code: 'HCM',
          starts_at: '2026-10-06T12:00:00.000000Z',
          ticket_count: 2,
          total_amount_vnd: 300000,
        }], []];
      }
      if (sql.includes('FROM booking_items bi')) {
        return [[{ ticket_type_id: 18, type_name: 'Standard', quantity: 2, unit_price_vnd: 150000, subtotal_vnd: 300000 }], []];
      }
      if (sql.includes('FROM tickets t')) {
        return [[
          { ticket_code: 'TCK-1', ticket_type_id: 18, ordinal: 1, type_name: 'Standard' },
          { ticket_code: 'TCK-2', ticket_type_id: 18, ordinal: 2, type_name: 'Standard' },
        ], []];
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };

  return { pool, calls };
}

function createCancellationPool({ status = 'CONFIRMED', startsAt = '2026-10-06T12:00:00.000000Z' } = {}) {
  const calls = { commits: 0, rollbacks: 0, releases: 0, updates: 0 };
  const booking = { id: 41, status, starts_at: startsAt };
  const connection = {
    async beginTransaction() {},
    async commit() { calls.commits += 1; },
    async rollback() { calls.rollbacks += 1; },
    release() { calls.releases += 1; },
    async query() { return [[{ now_utc: '2026-10-04T12:00:00.000000Z' }], []]; },
    async execute(sql) {
      if (sql.includes('FROM bookings b')) return [[booking], []];
      if (sql.includes('UPDATE bookings')) {
        calls.updates += 1;
        booking.status = 'CANCELLED';
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected connection query: ${sql}`);
    },
  };
  const pool = {
    getConnection: async () => connection,
    async execute(sql) {
      if (sql.includes('JOIN event_showings')) {
        return [[{
          id: 41,
          booking_code: 'BK-TEST',
          status: booking.status,
          booked_at: '2026-10-04T12:00:00.000000Z',
          cancelled_at: booking.status === 'CANCELLED' ? '2026-10-04T12:00:00.000000Z' : null,
          event_title: 'Test Event',
          showing_code: 'SHOW-1',
          venue_name: 'Hall A',
          city_code: 'HCM',
          starts_at: startsAt,
          ticket_count: 2,
          total_amount_vnd: 300000,
        }], []];
      }
      if (sql.includes('FROM booking_items bi')) return [[{ ticket_type_id: 18, type_name: 'Standard', quantity: 2, unit_price_vnd: 150000, subtotal_vnd: 300000 }], []];
      if (sql.includes('FROM tickets t')) return [[{ ticket_code: 'TCK-1', ticket_type_id: 18, ordinal: 1, type_name: 'Standard' }], []];
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };
  return { pool, calls };
}

test('confirmation commits one booking, price snapshot and one ticket per unit', async () => {
  const { pool, calls } = createPool();
  const result = await confirmReservation(pool, reservation.id, 7);

  assert.equal(result.created, true);
  assert.equal(result.booking.totalAmountVnd, 300000);
  assert.equal(result.booking.tickets.length, 2);
  assert.equal(calls.commits, 1);
  assert.equal(calls.rollbacks, 0);
  assert.equal(calls.bookingItems, 1);
  assert.equal(calls.tickets, 2);
  assert.equal(calls.releases, 1);
});

test('retry returns the booking already linked to the reservation without creating rows', async () => {
  const { pool, calls } = createPool({ existingBooking: true });
  const result = await confirmReservation(pool, reservation.id, 7);

  assert.equal(result.created, false);
  assert.equal(result.booking.id, 41);
  assert.equal(calls.commits, 1);
  assert.equal(calls.updates, 0);
  assert.equal(calls.bookingItems, 0);
  assert.equal(calls.tickets, 0);
});

test('failure while issuing tickets rolls back the consumed hold and booking writes', async () => {
  const { pool, calls } = createPool({ failOnTicket: true });

  await assert.rejects(confirmReservation(pool, reservation.id, 7), /simulated ticket insert failure/);
  assert.equal(calls.commits, 0);
  assert.equal(calls.rollbacks, 1);
  assert.equal(calls.updates, 1);
  assert.equal(calls.bookingItems, 1);
  assert.equal(calls.releases, 1);
});

test('cancellation changes a confirmed booking inside a committed transaction', async () => {
  const { pool, calls } = createCancellationPool();
  const booking = await cancelBooking(pool, 'BK-TEST', 7);

  assert.equal(booking.status, 'CANCELLED');
  assert.equal(booking.tickets[0].valid, false);
  assert.equal(calls.updates, 1);
  assert.equal(calls.commits, 1);
  assert.equal(calls.rollbacks, 0);
});

test('repeated cancellation is committed without another status update', async () => {
  const { pool, calls } = createCancellationPool({ status: 'CANCELLED' });
  const booking = await cancelBooking(pool, 'BK-TEST', 7);

  assert.equal(booking.status, 'CANCELLED');
  assert.equal(calls.updates, 0);
  assert.equal(calls.commits, 1);
});

test('cancellation at showing start rolls back without changing the booking', async () => {
  const { pool, calls } = createCancellationPool({ startsAt: '2026-10-04T12:00:00.000000Z' });

  await assert.rejects(cancelBooking(pool, 'BK-TEST', 7), { code: 'CANCELLATION_CLOSED' });
  assert.equal(calls.updates, 0);
  assert.equal(calls.commits, 0);
  assert.equal(calls.rollbacks, 1);
});