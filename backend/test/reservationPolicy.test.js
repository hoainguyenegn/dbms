import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReservationExpiry,
  normalizeReservationInput,
  sameReservationPayload,
} from '../src/services/reservationPolicy.js';

const requestKey = 'a6cf87e0-9a95-4dae-86f6-3f57cde13c37';

test('normalizes and sorts ticket items while preserving total quantity', () => {
  assert.deepEqual(
    normalizeReservationInput({
      showing_id: '12',
      request_key: requestKey,
      items: [{ ticket_type_id: 20, quantity: 1 }, { ticket_type_id: 10, quantity: 2 }],
    }),
    {
      showingId: 12,
      requestKey,
      items: [{ ticketTypeId: 10, quantity: 2 }, { ticketTypeId: 20, quantity: 1 }],
      totalQuantity: 3,
    },
  );
});

test('rejects duplicate ticket types and totals above six tickets', () => {
  assert.throws(
    () => normalizeReservationInput({ showing_id: 1, request_key: requestKey, items: [
      { ticket_type_id: 3, quantity: 1 }, { ticket_type_id: 3, quantity: 1 },
    ] }),
    { code: 'DUPLICATE_TICKET_TYPE' },
  );
  assert.throws(
    () => normalizeReservationInput({ showing_id: 1, request_key: requestKey, items: [
      { ticket_type_id: 3, quantity: 4 }, { ticket_type_id: 4, quantity: 3 },
    ] }),
    { code: 'RESERVATION_LIMIT_EXCEEDED' },
  );
});

test('same request payload matches independent of item order', () => {
  assert.equal(
    sameReservationPayload(
      [{ ticket_type_id: 10, quantity: 2 }, { ticket_type_id: 20, quantity: 1 }],
      [{ ticketTypeId: 20, quantity: 1 }, { ticketTypeId: 10, quantity: 2 }],
    ),
    true,
  );
});

test('reservation expiry is capped by the end of sales', () => {
  const now = '2026-10-23T12:00:00.000Z';
  assert.equal(
    calculateReservationExpiry(now, '2026-10-23T12:03:00.000Z').toISOString(),
    '2026-10-23T12:03:00.000Z',
  );
  assert.equal(
    calculateReservationExpiry(now, '2026-10-23T12:10:00.000Z').toISOString(),
    '2026-10-23T12:05:00.000Z',
  );
});