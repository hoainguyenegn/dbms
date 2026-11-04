import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { mysqlPool, redisClient } from '../src/config/database.js';
import { requestRegistration } from '../src/services/registrationService.js';

const enabled = process.env.TEST_INTEGRATION_MYSQL === '1';
test('F01–F06 shared authentication, catalog, reservation, booking and concurrency on MySQL/Redis', { skip: !enabled, timeout: 30000 }, async () => {
  assert.match(process.env.MYSQL_DATABASE, /^eventbox_integration_[a-f0-9]+$/);
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cachedIds = [];
  async function api(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  async function ok(path, options, status = 200) {
    const result = await api(path, options);
    assert.equal(result.status, status, `${path}: ${JSON.stringify(result.body)}`);
    return result.body;
  }
  const at = days => new Date(Date.now() + days * 86400000).toISOString();
  const password = 'integration-pass-123';
  try {
    await redisClient.connect();
    const passwordHash = await bcrypt.hash(password, 10);
    await mysqlPool.execute("INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('manager', 'manager@example.test', ?, 'Quản lý', 'MANAGER'), ('other', 'other@example.test', ?, 'Khách khác', 'USER')", [passwordHash, passwordHash]);
    const manager = (await ok('/api/auth/login', { method: 'POST', body: { email: 'manager@example.test', password } })).token;
    const other = (await ok('/api/auth/login', { method: 'POST', body: { email: 'other@example.test', password } })).token;
    // Capture only in this test; no SMTP/Resend messages are sent.
    let otp;
    await requestRegistration(mysqlPool, { email: 'customer@example.test', password, full_name: 'Khách hàng Việt' }, async (_email, value) => { otp = value; });
    const registered = await ok('/api/auth/verify-registration', { method: 'POST', body: { email: 'customer@example.test', code: otp } }, 201);
    const customer = registered.token;
    const loggedIn = await ok('/api/auth/login', { method: 'POST', body: { email: 'customer@example.test', password } });
    assert.equal(loggedIn.user.id, registered.user.id);
    assert.equal((await ok('/api/auth/me', { token: customer })).user.fullName, 'Khách hàng Việt');
    assert.equal((await api('/api/admin/events', { token: customer })).status, 403);
    assert.equal((await api('/api/bookings/my')).status, 401);
    const event = (await ok('/api/admin/events', { token: manager, method: 'POST', body: { event_code: 'EVT-INTEGRATION', title: 'Đêm nhạc tích hợp', category: 'MUSIC' } }, 201)).event;
    assert.equal((await api(`/api/events/${event.id}`)).status, 404);
    const showing = (await ok(`/api/admin/events/${event.id}/showings`, { token: manager, method: 'POST', body: { showing_code: 'SHOW-ONE', venue_name: 'Nhà hát thử nghiệm', city_code: 'HCM', sales_start_at: at(-1), sales_end_at: at(2), starts_at: at(3), ends_at: at(4) } }, 201)).showing;
    const ticket = (await ok(`/api/admin/showings/${showing.id}/ticket-types`, { token: manager, method: 'POST', body: { type_name: 'Tiêu chuẩn', price_vnd: 120000, capacity: 2 } }, 201)).ticket_type;
    await ok(`/api/admin/events/${event.id}/publish`, { token: manager, method: 'POST' });
    const catalog = await ok('/api/events?city=HCM&category=MUSIC'); assert.equal(catalog.total, 1); assert.equal(catalog.events[0].title, 'Đêm nhạc tích hợp');
    assert.equal((await api(`/api/admin/events/${event.id}`, { token: manager, method: 'PATCH', body: { title: 'No edits' } })).status, 409);
    const selection = { showing_id: showing.id, request_key: randomUUID(), items: [{ ticket_type_id: ticket.id, quantity: 2 }] };
    const hold = (await ok('/api/reservations', { token: customer, method: 'POST', body: selection }, 201)).reservation;
    cachedIds.push(hold.id);
    assert.ok(await redisClient.exists(`eventbox:reservation:${hold.id}`));
    const repeat = (await ok('/api/reservations', { token: customer, method: 'POST', body: selection })).reservation; assert.equal(repeat.id, hold.id);
    assert.equal((await api(`/api/reservations/${hold.id}`, { token: other })).status, 404);
    assert.equal((await api('/api/reservations', { token: other, method: 'POST', body: { ...selection, request_key: randomUUID() } })).status, 409);
    const booking = (await ok('/api/bookings/confirm', { token: customer, method: 'POST', body: { reservation_id: hold.id } }, 201)).booking;
    assert.equal(booking.ticketCount, 2); assert.equal(booking.totalAmountVnd, 240000); assert.equal(booking.tickets.length, 2);
    assert.equal(await redisClient.exists(`eventbox:reservation:${hold.id}`), 0);
    assert.equal((await ok('/api/bookings/confirm', { token: customer, method: 'POST', body: { reservation_id: hold.id } })).booking.id, booking.id);
    assert.equal((await api(`/api/bookings/${booking.bookingCode}`, { token: other })).status, 404);
    assert.equal((await ok('/api/bookings/my', { token: customer })).total, 1);
    const cancelled = (await ok(`/api/bookings/${booking.bookingCode}/cancel`, { token: customer, method: 'POST' })).booking;
    assert.equal(cancelled.status, 'CANCELLED'); assert.ok(cancelled.tickets.every(value => !value.valid));
    await ok(`/api/bookings/${booking.bookingCode}/cancel`, { token: customer, method: 'POST' });
    // Competing requests for the entire remaining capacity: exactly one can succeed.
    const contenders = await Promise.all([customer, other].map(token => api('/api/reservations', { token, method: 'POST', body: { ...selection, request_key: randomUUID() } })));
    for (const result of contenders) if (result.status === 201) cachedIds.push(result.body.reservation.id);
    assert.deepEqual(contenders.map(value => value.status).sort(), [201, 409]);
    const winner = contenders.find(value => value.status === 201).body.reservation; cachedIds.push(winner.id);
    const winnerToken = contenders[0].status === 201 ? customer : other;
    // Close and confirm concurrently: either confirmation precedes close, or it is rejected.
    const race = await Promise.all([
      api(`/api/admin/events/${event.id}/close`, { token: manager, method: 'POST' }),
      api('/api/bookings/confirm', { token: winnerToken, method: 'POST', body: { reservation_id: winner.id } }),
    ]);
    assert.equal(race[0].status, 200); assert.ok([201, 409].includes(race[1].status), JSON.stringify(race[1]));
    assert.equal((await api(`/api/events/${event.id}`)).status, 404);
    const [[counts]] = await mysqlPool.query("SELECT COUNT(*) AS total FROM reservations WHERE status = 'ACTIVE'"); assert.equal(counts.total, 0);
    const [[sum]] = await mysqlPool.query("SELECT COALESCE(SUM(bi.quantity),0) AS total FROM booking_items bi JOIN bookings b ON b.id=bi.booking_id WHERE b.status='CONFIRMED'"); assert.ok(Number(sum.total) <= 2);
  } finally {
    for (const id of cachedIds) if (redisClient.isReady) await redisClient.del(`eventbox:reservation:${id}`);
    if (redisClient.isOpen) redisClient.destroy();
    await new Promise(resolve => server.close(resolve));
    await mysqlPool.end();
  }
});
