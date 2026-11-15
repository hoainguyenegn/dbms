import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminStats, parseStatsFilters } from '../src/services/statsService.js';

test('stats filters reject invalid dates, arrays, reversed ranges and invalid IDs', () => {
  for (const query of [{ from: '2026-02-30' }, { from: ['2026-01-01'] }, { from: '2026-02-02', to: '2026-02-01' }, { eventId: '1 OR 1=1' }, { showingId: '-1' }]) {
    assert.throws(() => parseStatsFilters(query), { statusCode: 400 });
  }
  assert.deepEqual(parseStatsFilters({ from: '2028-02-29', eventId: '12' }), { from: '2028-02-29', eventId: 12 });
});

test('stats database failures propagate rather than returning successful zero totals', async () => {
  let rolledBack = false;
  let released = false;
  const failure = new Error('database unavailable');
  const connection = {
    async query(sql) { if (sql.includes('SELECT')) throw failure; return []; },
    async beginTransaction() {},
    async rollback() { rolledBack = true; },
    release() { released = true; },
  };
  await assert.rejects(getAdminStats({ async getConnection() { return connection; } }), failure);
  assert.equal(rolledBack, true);
  assert.equal(released, true);
});
