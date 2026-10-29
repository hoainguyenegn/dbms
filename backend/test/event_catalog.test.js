import test from 'node:test';
import assert from 'node:assert/strict';
import { eventData, showingData, ticketData, date, id } from '../src/controllers/eventValidation.js';
import { mysqlPool } from '../src/config/database.js';
import * as admin from '../src/controllers/adminEventController.js';
import * as publicEvents from '../src/controllers/eventController.js';

const showing = { showing_code: 'evt-s1', venue_name: 'Nhà hát', city_code: 'hcm', sales_start_at: '2030-01-01T08:00:00+07:00', sales_end_at: '2030-01-02T08:00:00+07:00', starts_at: '2030-01-03T08:00:00+07:00', ends_at: '2030-01-03T10:00:00+07:00' };
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
async function call(fn, req) { const res = response(); let error; await fn({ params: {}, query: {}, ...req }, res, value => { error = value; }); return { res, error }; }

test('Reject blank/non-string event values and forbidden patch fields', () => {
  for (const value of ['', '  ', 123, [], null]) assert.throws(() => eventData({ event_code: 'EVT', title: value, category: 'MUSIC' }));
  assert.throws(() => eventData({ title: 'OK', status: 'PUBLISHED' }, true));
  assert.throws(() => eventData({}, true));
  assert.equal(eventData({ event_code: ' evt ', title: ' Test ', category: ' music ' }).event_code, 'EVT');
});
test('Ticket validation preserves zero price and rejects truncation/default capacity', () => {
  assert.equal(ticketData({ type_name: 'Free', price_vnd: 0, capacity: 1 }).price_vnd, 0);
  for (const price of ['12x', 1.2, -1, true, null, '']) assert.throws(() => ticketData({ type_name: 'VIP', price_vnd: price, capacity: 1 }));
  for (const capacity of [0, 1.1, 100001, '12x']) assert.throws(() => ticketData({ type_name: 'VIP', price_vnd: 1, capacity }));
});
test('Vietnam date boundaries and schedule order', () => {
  assert.equal(date('2030-01-01', 'from').toISOString(), '2029-12-31T17:00:00.000Z');
  assert.equal(showingData(showing).starts_at.toISOString(), '2030-01-03T01:00:00.000Z');
  assert.throws(() => date('2030-02-30', 'from'));
  assert.throws(() => date('2030-01-01T24:00', 'from'));
  assert.throws(() => showingData({ ...showing, sales_end_at: showing.sales_start_at }));
  for (const value of ['1x', '1.5', '-1', '0', []]) assert.throws(() => id(value));
});

test('F01/F02 controllers serialize writes, rollback failures and handle connection errors', async t => {
  let log, execute;
  const db = {
    beginTransaction: async () => log.push('begin'), commit: async () => log.push('commit'), rollback: async () => log.push('rollback'), release: () => log.push('release'),
    execute: async (sql, params) => { log.push(sql); return execute(sql, params); },
  };
  t.mock.method(mysqlPool, 'getConnection', async () => db);
  await t.test('publish rejects a showing without tickets and rolls back', async () => {
    log = [];
    execute = async sql => sql.includes('FOR UPDATE') ? [[{ id: 1, status: 'DRAFT' }]] : [[{ ...showingData(showing), server_now: new Date('2029-01-01Z'), ticket_count: 0 }]];
    const { error } = await call(admin.publishEvent, { params: { id: '1' } });
    assert.equal(error.errorCode, 'NO_TICKET_TYPES');
    assert.ok(log.includes('rollback')); assert.equal(log.at(-1), 'release');
    assert.ok(!log.some(value => value.startsWith('UPDATE')));
  });
  await t.test('create-and-publish rejects past sales deadline and rolls back inserts', async () => {
    log = [];
    execute = async sql => sql.startsWith('INSERT') ? [{ insertId: 1 }] : [[{ ...showingData(showing), server_now: new Date('2031-01-01Z'), ticket_count: 1 }]];
    const { error } = await call(admin.createEvent, { body: { event_code: 'EVT', title: 'Test', category: 'MUSIC', showing, ticket_types: [{ type_name: 'VIP', price_vnd: 1, capacity: 1 }], publish_now: true } });
    assert.equal(error.errorCode, 'INVALID_SALES_SCHEDULE'); assert.ok(log.includes('rollback')); assert.ok(!log.includes('commit'));
  });
  await t.test('create-and-publish requires a showing instead of silently creating a draft', async () => {
    log = []; execute = async sql => sql.startsWith('INSERT') ? [{ insertId: 1 }] : [[]];
    const { error } = await call(admin.createEvent, { body: { event_code: 'EVT', title: 'Test', category: 'MUSIC', publish_now: true } });
    assert.equal(error.errorCode, 'NO_SHOWINGS'); assert.ok(log.includes('rollback'));
  });
  await t.test('published event rejects ticket edits after locking its parent', async () => {
    log = []; execute = async sql => sql.includes('FOR UPDATE') ? [[{ id: 1, status: 'PUBLISHED' }]] : [[{ event_id: 1 }]];
    const { error } = await call(admin.updateTicketType, { params: { id: '2' }, body: { capacity: 20 } });
    assert.equal(error.statusCode, 409); assert.ok(log.includes('rollback'));
    assert.ok(!log.some(value => value.startsWith('UPDATE')));
  });
  await t.test('delete child failure rolls back the whole event deletion', async () => {
    log = []; execute = async sql => {
      if (sql.includes('FOR UPDATE')) return [[{ id: 1, status: 'DRAFT' }]];
      if (sql.startsWith('DELETE FROM event_showings')) throw Object.assign(new Error('dependent reservation'), { code: 'ER_ROW_IS_REFERENCED_2' });
      return [{ affectedRows: 1 }];
    };
    const { error } = await call(admin.deleteEvent, { params: { id: '1' } });
    assert.equal(error.code, 'ER_ROW_IS_REFERENCED_2'); assert.ok(log.includes('rollback')); assert.ok(!log.includes('commit'));
  });
  await t.test('pool acquisition failure is passed to middleware', async () => {
    t.mock.method(mysqlPool, 'getConnection', async () => { throw new Error('DB unavailable'); });
    const { error } = await call(admin.updateEvent, { params: { id: '1' }, body: { title: 'Test' } });
    assert.equal(error.message, 'DB unavailable');
  });
});

test('F03 filters, pagination and invalid input', async t => {
  const queries = [];
  t.mock.method(mysqlPool, 'execute', async (sql, params) => {
    queries.push({ sql, params });
    return sql.includes('COUNT(DISTINCT') ? [[{ total: 1 }]] : [[{ id: 1, city_code: 'HCM', venue_name: 'Nhà hát', min_price: 0 }]];
  });
  const { res, error } = await call(publicEvents.getPublicEvents, { query: { city: 'HCM', from: '2030-01-01', to: '2030-01-02', page_size: '200' } });
  assert.equal(error, undefined); assert.equal(res.body.page_size, 100);
  assert.equal(queries[0].params[1].toISOString(), '2029-12-31T17:00:00.000Z');
  assert.ok(queries[1].sql.includes('ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY s.starts_at, s.id)'));
  assert.ok(!queries[1].sql.includes('MIN(s.venue_name)'));
  for (const query of [{ from: 'bad' }, { from: '2030-01-02', to: '2030-01-01' }, { page: '2x' }, { city: ['HCM'] }]) {
    const result = await call(publicEvents.getPublicEvents, { query }); assert.equal(result.error.statusCode, 400);
  }
});
