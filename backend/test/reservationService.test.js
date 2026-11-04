import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReservation,
  getReservation,
  releaseReservation,
} from '../src/services/reservationService.js';

const requestKey = 'a6cf87e0-9a95-4dae-86f6-3f57cde13c37';
const reservationId = 'f7e8de3b-bdd9-4ab8-bfaf-a60ff0bf3c73';

function createPool({ capacityRows, existingReservation = null, existingItems = [] }) {
  const calls = { commits: 0, rollbacks: 0, releases: 0, insertedReservations: 0, insertedItems: 0 };
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const showing = {
    id: 12,
    event_status: 'PUBLISHED',
    sales_start_at: new Date(Date.now() - 60 * 1000).toISOString(),
    sales_end_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    starts_at: new Date(Date.now() + 11 * 60 * 1000).toISOString(),
    sales_end_utc: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    now_utc: new Date().toISOString(),
  };
  const connection = {
    async beginTransaction() {},
    async commit() { calls.commits += 1; },
    async rollback() { calls.rollbacks += 1; },
    release() { calls.releases += 1; },
    async execute(sql) {
      if (sql.startsWith('SET TRANSACTION')) return [[], []];
      if (sql.includes('SELECT showing_id FROM bookings WHERE booking_code')) return [[{ showing_id: 12 }], []];
      if (sql.includes('SELECT id FROM event_showings WHERE id')) return [[{ id: 12 }], []];
      if (sql.includes('SELECT e.id FROM events e')) return [[{ id: 1 }], []];
      if (sql.includes('FROM event_showings s')) return [[showing], []];
      if (sql.includes('WHERE user_id = ? AND request_key = ?')) {
        return [existingReservation ? [existingReservation] : [], []];
      }
      if (sql.includes('SELECT ticket_type_id, quantity FROM reservation_items')) return [existingItems, []];
      if (sql.includes("SET status = 'EXPIRED'")) return [{ affectedRows: 0 }, []];
      if (sql.includes("WHERE user_id = ? AND showing_id = ? AND status = 'ACTIVE'")) return [[], []];
      if (sql.includes('FROM ticket_types tt') && sql.includes('AS sold')) return [capacityRows, []];
      if (sql.includes('AS expires_at')) return [[{ expires_at: expiresAt }], []];
      if (sql.includes('INSERT INTO reservations')) {
        calls.insertedReservations += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('INSERT INTO reservation_items')) {
        calls.insertedItems += 1;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
  };
  const pool = {
    getConnection: async () => connection,
    async execute(sql) {
      if (sql.startsWith('SET TRANSACTION')) return [[], []];
      if (sql.includes('SELECT showing_id FROM bookings WHERE booking_code')) return [[{ showing_id: 12 }], []];
      if (sql.includes('SELECT id FROM event_showings WHERE id')) return [[{ id: 12 }], []];
      if (sql.includes('SELECT e.id FROM events e')) return [[{ id: 1 }], []];
      if (sql.includes("SET status = 'EXPIRED'")) return [{ affectedRows: 0 }, []];
      if (sql.includes('FROM reservations r')) {
        return [[{
          id: existingReservation?.id || reservationId,
          user_id: 7,
          showing_id: 12,
          request_key: requestKey,
          status: 'ACTIVE',
          expires_at: expiresAt,
          event_title: 'EventBox Fixture',
          showing_code: 'SHW-12',
          venue_name: 'Hall A',
          city_code: 'HCM',
          starts_at: showing.starts_at,
        }], []];
      }
      if (sql.includes('FROM reservation_items ri')) {
        return [[{ ticket_type_id: 30, quantity: 2, type_name: 'Standard', price_vnd: 350000 }], []];
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };
  return { pool, calls };
}

function createRedis() {
  const calls = [];
  return {
    calls,
    client: {
      isReady: true,
      async eval(script, options) {
        calls.push({ script, ...options });
        return 1;
      },
    },
  };
}

const input = {
  request_key: requestKey,
  showing_id: 12,
  items: [{ ticket_type_id: 30, quantity: 2 }],
};

test('creates all reservation rows in MySQL and atomically caches the hold', async () => {
  const { pool, calls } = createPool({ capacityRows: [{ id: 30, type_name: 'Standard', price_vnd: 350000, capacity: 10, sold: 1, held: 2 }] });
  const redis = createRedis();
  const result = await createReservation(pool, redis.client, input, 7);

  assert.equal(result.created, true);
  assert.equal(result.redisCached, true);
  assert.equal(result.reservation.totalQuantity, 2);
  assert.equal(result.reservation.totalAmountVnd, 700000);
  assert.equal(calls.commits, 1);
  assert.equal(calls.rollbacks, 0);
  assert.equal(calls.insertedReservations, 1);
  assert.equal(calls.insertedItems, 1);
  assert.equal(redis.calls.length, 1);
  assert.equal(redis.calls[0].keys[0], `eventbox:reservation:${result.reservation.id}`);
});

test('insufficient capacity rejects the entire hold before any reservation insert', async () => {
  const { pool, calls } = createPool({ capacityRows: [{ id: 30, type_name: 'Standard', price_vnd: 350000, capacity: 5, sold: 2, held: 2 }] });
  const redis = createRedis();

  await assert.rejects(createReservation(pool, redis.client, input, 7), { code: 'INSUFFICIENT_TICKETS' });
  assert.equal(calls.commits, 0);
  assert.equal(calls.rollbacks, 1);
  assert.equal(calls.insertedReservations, 0);
  assert.equal(calls.insertedItems, 0);
  assert.equal(redis.calls.length, 0);
});

test('same request key and payload returns the original hold without writing again', async () => {
  const existingReservation = {
    id: reservationId,
    showing_id: 12,
    request_key: requestKey,
    status: 'ACTIVE',
    expires_at: new Date(Date.now() + 120000).toISOString(),
  };
  const { pool, calls } = createPool({
    capacityRows: [],
    existingReservation,
    existingItems: [{ ticket_type_id: 30, quantity: 2 }],
  });
  const redis = createRedis();
  const result = await createReservation(pool, redis.client, input, 7);

  assert.equal(result.created, false);
  assert.equal(result.reservation.id, reservationId);
  assert.equal(calls.commits, 1);
  assert.equal(calls.insertedReservations, 0);
  assert.equal(calls.insertedItems, 0);
  assert.equal(redis.calls.length, 0);
});

test('same request key with different selection is rejected as a conflict', async () => {
  const { pool, calls } = createPool({
    capacityRows: [],
    existingReservation: { id: reservationId, showing_id: 12 },
    existingItems: [{ ticket_type_id: 31, quantity: 1 }],
  });
  const redis = createRedis();

  await assert.rejects(createReservation(pool, redis.client, input, 7), { code: 'REQUEST_KEY_CONFLICT' });
  assert.equal(calls.rollbacks, 1);
  assert.equal(calls.insertedReservations, 0);
});

test('MySQL remains authoritative and creates a hold when Redis is unavailable', async () => {
  const { pool, calls } = createPool({ capacityRows: [{ id: 30, type_name: 'Standard', price_vnd: 350000, capacity: 10, sold: 1, held: 2 }] });
  const redis = { isReady: false };
  const result = await createReservation(pool, redis, input, 7);

  assert.equal(result.created, true);
  assert.equal(result.redisCached, false);
  assert.equal(calls.commits, 1);
  assert.equal(calls.insertedReservations, 1);
});

test('reservation reads are scoped to the authenticated owner', async () => {
  const pool = {
    async execute() { return [[], []]; },
  };
  await assert.rejects(getReservation(pool, reservationId, 999), { code: 'RESERVATION_NOT_FOUND' });
});

test('release changes an active hold once and removes its Redis cache', async () => {
  const calls = { commits: 0, updates: 0, redisDeletes: 0, released: false };
  const connection = {
    async beginTransaction() {},
    async commit() { calls.commits += 1; },
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.startsWith('SET TRANSACTION')) return [[], []];
      if (sql.includes('SELECT showing_id FROM bookings WHERE booking_code')) return [[{ showing_id: 12 }], []];
      if (sql.includes('SELECT id FROM event_showings WHERE id')) return [[{ id: 12 }], []];
      if (sql.includes('SELECT e.id FROM events e')) return [[{ id: 1 }], []];
      if (sql.includes('SELECT id FROM event_showings')) return [[{ id: 12 }], []];
      if (sql.includes('SELECT status, expires_at')) return [[{ status: 'ACTIVE', is_expired: 0 }], []];
      if (sql.includes('UPDATE reservations SET status')) {
        calls.updates += 1;
        calls.released = true;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
  };
  const pool = {
    async execute(sql) {
      if (sql.startsWith('SET TRANSACTION')) return [[], []];
      if (sql.includes('SELECT showing_id FROM bookings WHERE booking_code')) return [[{ showing_id: 12 }], []];
      if (sql.includes('SELECT id FROM event_showings WHERE id')) return [[{ id: 12 }], []];
      if (sql.includes('SELECT e.id FROM events e')) return [[{ id: 1 }], []];
      if (sql.includes('SELECT showing_id FROM reservations')) return [[{ showing_id: 12 }], []];
      if (sql.includes("SET status = 'EXPIRED'")) return [{ affectedRows: 0 }, []];
      if (sql.includes('FROM reservations r')) {
        return [[{
          id: reservationId, user_id: 7, showing_id: 12, request_key: requestKey,
          status: calls.released ? 'RELEASED' : 'ACTIVE',
          expires_at: new Date(Date.now() + 120000).toISOString(),
          event_title: 'EventBox Fixture', showing_code: 'SHW-12', venue_name: 'Hall A',
          city_code: 'HCM', starts_at: new Date(Date.now() + 300000).toISOString(),
        }], []];
      }
      if (sql.includes('FROM reservation_items ri')) return [[{ ticket_type_id: 30, quantity: 2, type_name: 'Standard', price_vnd: 350000 }], []];
      throw new Error(`Unexpected pool query: ${sql}`);
    },
    async getConnection() { return connection; },
  };
  const redis = {
    isReady: true,
    async eval() { calls.redisDeletes += 1; return 1; },
  };

  const result = await releaseReservation(pool, redis, reservationId, 7);
  assert.equal(result.status, 'RELEASED');
  assert.equal(calls.updates, 1);
  assert.equal(calls.commits, 1);
  assert.equal(calls.redisDeletes, 1);
});