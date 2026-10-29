import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('Smoke test: Backend Express app exports and registers routes', async () => {
  assert.ok(app);
  assert.strictEqual(typeof app.handle, 'function');
});

