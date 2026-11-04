import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReservationCanBeConfirmed, canCancelBooking } from '../src/services/bookingPolicy.js';

const now = '2026-10-04T12:00:00.000Z';

function activeReservation(overrides = {}) {
  return {
    status: 'ACTIVE',
    expires_at: '2026-10-04T12:05:00.000Z',
    event_status: 'PUBLISHED',
    sales_start_at: '2026-10-01T00:00:00.000Z',
    sales_end_at: '2026-10-05T00:00:00.000Z',
    ...overrides,
  };
}

test('allows confirmation inside the hold and sales windows', () => {
  assert.doesNotThrow(() => assertReservationCanBeConfirmed(activeReservation(), now));
});

test('rejects a hold exactly at its expiry boundary', () => {
  assert.throws(
    () => assertReservationCanBeConfirmed(activeReservation({ expires_at: now }), now),
    { code: 'RESERVATION_EXPIRED' },
  );
});

test('rejects confirmation at the sales end boundary', () => {
  assert.throws(
    () => assertReservationCanBeConfirmed(activeReservation({ sales_end_at: now }), now),
    { code: 'SHOWING_NOT_ON_SALE' },
  );
});

test('allows cancelling a confirmed booking before the showing starts', () => {
  assert.equal(canCancelBooking({ status: 'CONFIRMED', starts_at: '2026-10-05T12:00:00.000Z' }, now), true);
});

test('treats repeated cancellation as an idempotent no-op', () => {
  assert.equal(canCancelBooking({ status: 'CANCELLED', starts_at: '2026-10-05T12:00:00.000Z' }, now), false);
});

test('rejects cancellation at the showing start boundary', () => {
  assert.throws(
    () => canCancelBooking({ status: 'CONFIRMED', starts_at: now }, now),
    { code: 'CANCELLATION_CLOSED' },
  );
});