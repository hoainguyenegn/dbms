import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOtp, verifyOtp, getVerifiedData, consumeVerifiedToken } from '../src/services/otpService.js';

test('OTP Service: saves, verifies valid OTP, and generates verification token', async () => {
  const testEmail = 'test_user_otp@example.com';
  const testOtp = '123456';

  await saveOtp(testEmail, testOtp, 'Nguyễn Văn Test');

  // Test sai OTP
  const failResult = await verifyOtp(testEmail, '999999');
  assert.strictEqual(failResult.valid, false);
  assert.strictEqual(failResult.error, 'INVALID_OTP');

  // Test đúng OTP
  const successResult = await verifyOtp(testEmail, testOtp);
  assert.strictEqual(successResult.valid, true);
  assert.ok(successResult.verificationToken);

  // Test đọc verification token
  const verifiedData = await getVerifiedData(successResult.verificationToken);
  assert.ok(verifiedData);
  assert.strictEqual(verifiedData.email, testEmail);

  // Test tiêu hủy token
  await consumeVerifiedToken(successResult.verificationToken);
  const consumedData = await getVerifiedData(successResult.verificationToken);
  assert.strictEqual(consumedData, null);
});

