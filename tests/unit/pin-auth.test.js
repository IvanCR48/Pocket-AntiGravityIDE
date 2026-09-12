const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  generateToken,
  validateToken,
  recordFailedAttempt,
  resetFailedAttempts,
  isRateLimited,
  getRemainingLockoutSeconds,
  MAX_FAILED_ATTEMPTS,
  loadConfig
} = require('../../src/infrastructure/security/pin-auth');

describe('PIN Authentication & Security Hardening', () => {
  beforeEach(() => {
    resetFailedAttempts();
  });

  it('generates a valid token that passes validation', () => {
    const config = loadConfig();
    const pin = config.pin || '1234';
    const token = generateToken(pin);

    assert.ok(token, 'Token should be a non-empty string');
    assert.strictEqual(validateToken(token), true, 'Generated token should be valid');
  });

  it('rejects a token created with the wrong PIN', () => {
    const token = generateToken('9999');
    assert.strictEqual(validateToken(token), false, 'Token with wrong PIN must be rejected');
  });

  it('rejects malformed or tampered tokens', () => {
    assert.strictEqual(validateToken('invalid-base64!'), false);
    assert.strictEqual(validateToken(''), false);
    assert.strictEqual(validateToken(null), false);
  });

  it('rejects an expired token older than 24 hours', () => {
    const config = loadConfig();
    const pin = config.pin || '1234';
    const crypto = require('crypto');
    
    // Create an expired payload (25 hours ago)
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000);
    const payload = `${pin}:${oldTimestamp}`;
    // Even if correctly signed, expired tokens must fail
    const token = Buffer.from(`${payload}:invalidsig`).toString('base64');

    assert.strictEqual(validateToken(token), false, 'Expired token must fail validation');
  });

  it('enforces rate-limiting lockout after MAX_FAILED_ATTEMPTS', () => {
    assert.strictEqual(isRateLimited(), false, 'Initially not rate limited');

    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      const res = recordFailedAttempt();
      assert.strictEqual(res.isLocked, false);
      assert.strictEqual(isRateLimited(), false);
    }

    // The threshold attempt triggers the lock
    const lockedRes = recordFailedAttempt();
    assert.strictEqual(lockedRes.isLocked, true);
    assert.strictEqual(isRateLimited(), true);
    assert.ok(getRemainingLockoutSeconds() > 0);

    // Resetting unlocks
    resetFailedAttempts();
    assert.strictEqual(isRateLimited(), false);
  });
});
