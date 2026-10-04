import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashRegistrationCode,
  requestRegistration,
  validateRegistrationInput,
  verifyRegistration,
} from '../src/services/registrationService.js';

const validInput = {
  username: 'event_user',
  full_name: 'Nguyen Minh Anh',
  email: 'MinhAnh@example.com',
  password: 'secure-pass-123',
};

function createPool({ pending = null, existingUser = false, failConsume = false } = {}) {
  const state = {
    pending,
    user: null,
    commits: 0,
    rollbacks: 0,
    releases: 0,
    insertedOtp: false,
    deletedOtp: false,
  };
  const connection = {
    async beginTransaction() {},
    async commit() { state.commits += 1; },
    async rollback() {
      state.rollbacks += 1;
      state.user = null;
      state.pending = pending;
    },
    release() { state.releases += 1; },
    async execute(sql, values = []) {
      if (sql.includes('DELETE FROM registration_otps WHERE expires_at')) return [{ affectedRows: 0 }, []];
      if (sql.includes('SELECT id, email, username')) return [state.pending ? [{ ...state.pending, within_cooldown: 0 }] : [], []];
      if (sql.includes('INSERT INTO registration_otps')) {
        const [id, email, username, password_hash, full_name, otp_hash] = values;
        state.pending = { id, email, username, password_hash, full_name, otp_hash, attempts: 0, is_active: 1 };
        state.insertedOtp = true;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('SELECT id, email, username, password_hash')) return [state.pending ? [{ ...state.pending }] : [], []];
      if (sql.includes('UPDATE registration_otps SET attempts')) {
        state.pending.attempts += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('INSERT INTO users')) {
        state.user = { id: 24, username: values[0], password_hash: values[1], full_name: values[2], email: values[3] };
        return [{ insertId: 24 }, []];
      }
      if (sql.includes('DELETE FROM registration_otps') && sql.includes('WHERE id = ?')) {
        if (!failConsume) {
          state.deletedOtp = true;
          state.pending = null;
        }
        return [{ affectedRows: failConsume ? 0 : 1 }, []];
      }
      throw new Error(`Unexpected connection query: ${sql}`);
    },
  };
  const pool = {
    getConnection: async () => connection,
    async execute(sql) {
      if (sql.includes('SELECT id FROM users')) return [existingUser ? [{ id: 5 }] : [], []];
      if (sql.includes('DELETE FROM registration_otps WHERE id')) {
        state.deletedOtp = true;
        state.pending = null;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };
  return { pool, state };
}

test('validates and normalizes registration fields', () => {
  assert.deepEqual(validateRegistrationInput(validInput), {
    username: 'event_user',
    fullName: 'Nguyen Minh Anh',
    email: 'minhanh@example.com',
    password: 'secure-pass-123',
  });
  assert.throws(() => validateRegistrationInput({ ...validInput, username: 'x' }), { code: 'INVALID_USERNAME' });
  assert.throws(() => validateRegistrationInput({ ...validInput, password: 'short' }), { code: 'INVALID_PASSWORD' });
});

test('stores only an OTP hash before sending and reports its expiry', async () => {
  process.env.JWT_SECRET = 'otp-unit-test-secret';
  const { pool, state } = createPool();
  let emailedCode;
  const result = await requestRegistration(pool, validInput, async (_email, code) => { emailedCode = code; });

  assert.equal(result.email, 'minhanh@example.com');
  assert.equal(result.expiresInSeconds, 600);
  assert.match(emailedCode, /^\d{6}$/);
  assert.equal(state.pending.otp_hash, hashRegistrationCode('minhanh@example.com', emailedCode, process.env.JWT_SECRET));
  assert.notEqual(state.pending.otp_hash, emailedCode);
  assert.equal(state.commits, 1);
  assert.equal(state.releases, 1);
});

test('verification increments attempts and never creates a user for a wrong code', async () => {
  process.env.JWT_SECRET = 'otp-unit-test-secret';
  const email = 'minhanh@example.com';
  const { pool, state } = createPool({ pending: {
    id: 'otp-1', email, username: 'event_user', password_hash: 'bcrypt-hash',
    full_name: 'Nguyen Minh Anh', otp_hash: hashRegistrationCode(email, '123456', process.env.JWT_SECRET),
    attempts: 0, is_active: 1,
  } });

  await assert.rejects(verifyRegistration(pool, { email, code: '654321' }), { code: 'OTP_INVALID' });
  assert.equal(state.pending.attempts, 1);
  assert.equal(state.user, null);
  assert.equal(state.commits, 1);
  assert.equal(state.rollbacks, 0);
});

test('correct OTP creates the account once and consumes the pending code', async () => {
  process.env.JWT_SECRET = 'otp-unit-test-secret';
  const email = 'minhanh@example.com';
  const { pool, state } = createPool({ pending: {
    id: 'otp-1', email, username: 'event_user', password_hash: 'bcrypt-hash',
    full_name: 'Nguyen Minh Anh', otp_hash: hashRegistrationCode(email, '123456', process.env.JWT_SECRET),
    attempts: 0, is_active: 1,
  } });

  const user = await verifyRegistration(pool, { email, code: '123456' });
  assert.deepEqual(user, { id: 24, username: 'event_user', fullName: 'Nguyen Minh Anh', email, role: 'USER' });
  assert.equal(state.user.username, 'event_user');
  assert.equal(state.pending, null);
  assert.equal(state.deletedOtp, true);
  assert.equal(state.commits, 1);
});

test('OTP expiring before final consume rolls back account creation', async () => {
  process.env.JWT_SECRET = 'otp-unit-test-secret';
  const email = 'minhanh@example.com';
  const pending = {
    id: 'otp-1', email, username: 'event_user', password_hash: 'bcrypt-hash',
    full_name: 'Nguyen Minh Anh', otp_hash: hashRegistrationCode(email, '123456', process.env.JWT_SECRET),
    attempts: 0, is_active: 1,
  };
  const { pool, state } = createPool({ pending, failConsume: true });

  await assert.rejects(verifyRegistration(pool, { email, code: '123456' }), { code: 'OTP_EXPIRED' });
  assert.equal(state.user, null);
  assert.equal(state.pending, pending);
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});

test('failed email delivery removes the pending code and does not leave an account', async () => {
  process.env.JWT_SECRET = 'otp-unit-test-secret';
  const { pool, state } = createPool();

  await assert.rejects(
    requestRegistration(pool, validInput, async () => { throw new Error('provider unavailable'); }),
    { code: 'EMAIL_DELIVERY_FAILED' },
  );
  assert.equal(state.pending, null);
  assert.equal(state.deletedOtp, true);
});