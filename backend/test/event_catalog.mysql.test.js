import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mysqlPool } from '../src/config/database.js';
import * as admin from '../src/controllers/adminEventController.js';
import * as publicEvents from '../src/controllers/eventController.js';

// Explicitly enabled: uses the configured database, rolls back all fixture rows.
test('F01–F03 MySQL lifecycle and matching-showing query', { skip: process.env.TEST_CATALOG_MYSQL !== '1' }, async t => {
  const db = await mysqlPool.getConnection();
  await db.beginTransaction();
  const wrapper = {
    execute: (...args) => db.execute(...args),
    beginTransaction: () => db.query('SAVEPOINT catalog_operation'),
    commit: () => db.query('RELEASE SAVEPOINT catalog_operation'),
    rollback: () => db.query('ROLLBACK TO SAVEPOINT catalog_operation'),
    release() {},
  };
  t.mock.method(mysqlPool, 'getConnection', async () => wrapper);
  t.mock.method(mysqlPool, 'execute', (...args) => db.execute(...args));
  const call = async (fn, input) => {
    let error;
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await fn({ params: {}, query: {}, ...input }, res, value => { error = value; });
    return { ...res, error };
  };
  const ok = async (fn, input) => { const result = await call(fn, input); assert.equal(result.error, undefined, result.error?.message); return result.body; };
  const prefix = `QA${randomBytes(5).toString('hex').toUpperCase()}`;
  const iso = day => new Date(Date.now() + day * 86400000).toISOString();
  try {
    const created = await ok(admin.createEvent, { body: { event_code: prefix, title: prefix, category: 'MUSIC' } });
    const eventId = String(created.event.id);
    const duplicate = await call(admin.createEvent, { body: { event_code: prefix.toLowerCase(), title: 'Duplicate', category: 'MUSIC' } });
    assert.equal(duplicate.error.code, 'ER_DUP_ENTRY');
    const base = { showing_code: `${prefix}-S1`, venue_name: 'Z First venue', city_code: 'HCM', sales_start_at: iso(-1), sales_end_at: iso(2), starts_at: iso(3), ends_at: iso(4) };
    const first = (await ok(admin.createShowing, { params: { id: eventId }, body: base })).showing;
    const another = (await ok(admin.createEvent, { body: { event_code: `${prefix}-OTHER`, title: 'Other event', category: 'MUSIC' } })).event;
    await ok(admin.createShowing, { params: { id: String(another.id) }, body: base });
    const sameParent = await call(admin.createShowing, { params: { id: eventId }, body: base });
    assert.equal(sameParent.error.code, 'ER_DUP_ENTRY');
    const second = (await ok(admin.createShowing, { params: { id: eventId }, body: { ...base, showing_code: `${prefix}-S2`, venue_name: 'A Later venue', city_code: 'HN', starts_at: iso(5), ends_at: iso(6) } })).showing;
    const firstTicket = (await ok(admin.createTicketType, { params: { id: String(first.id) }, body: { type_name: 'Free', price_vnd: 0, capacity: 10 } })).ticket_type;
    await ok(admin.createTicketType, { params: { id: String(second.id) }, body: { type_name: 'VIP', price_vnd: 500000, capacity: 10 } });
    const wrongParent = await call(admin.updateTicketType, { params: { id: String(firstTicket.id), showingId: String(second.id) }, body: { capacity: 99 } });
    assert.equal(wrongParent.error.statusCode, 404);
    await ok(admin.updateShowing, { params: { id: String(first.id), eventId }, body: { venue_name: 'Z Correct first venue' } });
    await ok(admin.updateTicketType, { params: { id: String(firstTicket.id), showingId: String(first.id) }, body: { capacity: 20 } });
    await ok(admin.publishEvent, { params: { id: eventId } });
    const found = await ok(publicEvents.getPublicEvents, { query: { search: prefix } });
    assert.equal(found.total, 1); assert.equal(found.events[0].venue_name, 'Z Correct first venue'); assert.equal(found.events[0].city_code, 'HCM'); assert.equal(Number(found.events[0].min_price), 0);
    const filtered = await ok(publicEvents.getPublicEvents, { query: { search: prefix, city: 'HN' } });
    assert.equal(filtered.events[0].venue_name, 'A Later venue');
    const detail = await ok(publicEvents.getPublicEventDetail, { params: { id: eventId } });
    assert.equal(detail.event.showings[0].ticket_types[0].available_capacity, 20);
    const rejected = await call(admin.updateEvent, { params: { id: eventId }, body: { title: 'No edit after publish' } });
    assert.equal(rejected.error.statusCode, 409);
    await ok(admin.closeEvent, { params: { id: eventId } });
    const hidden = await call(publicEvents.getPublicEventDetail, { params: { id: eventId } }); assert.equal(hidden.error, undefined); assert.equal(hidden.code, 404);
    const reopen = await call(admin.publishEvent, { params: { id: eventId } }); assert.equal(reopen.error.statusCode, 409);
    const draft = (await ok(admin.createEvent, { body: { event_code: `${prefix}-DEL`, title: 'Delete draft', category: 'MUSIC', showing: { ...base, showing_code: `${prefix}-DEL-S1` }, ticket_types: [{ type_name: 'VIP', price_vnd: 10, capacity: 1 }] } })).event;
    const draftDetail = await ok(admin.getAdminEventDetail, { params: { id: String(draft.id) } });
    const draftShowing = draftDetail.event.showings[0];
    const [user] = await db.execute("INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, 'USER')", [prefix, 'test-fixture-not-login', 'QA fixture', `${prefix}@example.test`]);
    const reservationId = randomBytes(16).toString('hex');
    await db.execute('INSERT INTO reservations (id, user_id, showing_id, request_key, expires_at) VALUES (?, ?, ?, ?, ?)', [reservationId, user.insertId, draftShowing.id, randomBytes(16).toString('hex'), new Date(Date.now() + 300000)]);
    const protectedDelete = await call(admin.deleteEvent, { params: { id: String(draft.id) } });
    assert.equal(protectedDelete.error.code, 'ER_ROW_IS_REFERENCED_2');
    const [[restored]] = await db.execute('SELECT COUNT(*) AS total FROM ticket_types WHERE showing_id = ?', [draftShowing.id]);
    assert.equal(restored.total, 1);
    await db.execute('DELETE FROM reservations WHERE id = ?', [reservationId]);
    await ok(admin.deleteEvent, { params: { id: String(draft.id) } });
    const [[remaining]] = await db.execute('SELECT COUNT(*) AS total FROM event_showings WHERE event_id = ?', [draft.id]); assert.equal(remaining.total, 0);
  } finally {
    await db.rollback(); db.release();
    t.mock.restoreAll();
    await mysqlPool.end();
  }
});
