const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'pocket.config.json');
const SERVER_SECRET = crypto.randomBytes(32).toString('hex');

// Token Validity: 24 Hours
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

// Rate-limiting configuration for brute-force protection
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let failedAttempts = 0;
let lockoutUntil = 0;

/**
 * Loads configuration from pocket.config.json or environment.
 * @returns {{pin: string, port: number, workspaceRoot?: string}}
 */
function loadConfig() {
  let config = { pin: '1234', port: 3000 };

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = { ...config, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('[Auth] Could not read pocket.config.json:', err.message);
  }

  if (process.env.POCKET_PIN !== undefined) {
    config.pin = process.env.POCKET_PIN;
  }

  if (config.pin === '1234') {
    console.warn('⚠️  [Security Warning] Using default PIN "1234". Set a custom PIN in pocket.config.json for secure remote access.');
  }

  return config;
}

/**
 * Checks if authentication is currently rate-limited due to failed attempts.
 * @returns {boolean}
 */
function isRateLimited() {
  if (Date.now() < lockoutUntil) return true;
  if (lockoutUntil && Date.now() >= lockoutUntil) {
    failedAttempts = 0;
    lockoutUntil = 0;
  }
  return false;
}

/**
 * Returns remaining seconds of lockout.
 * @returns {number}
 */
function getRemainingLockoutSeconds() {
  if (!isRateLimited()) return 0;
  return Math.ceil((lockoutUntil - Date.now()) / 1000);
}

/**
 * Records a failed authentication attempt.
 * @returns {{failedAttempts: number, isLocked: boolean, remainingSeconds: number}}
 */
function recordFailedAttempt() {
  failedAttempts++;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  return {
    failedAttempts,
    isLocked: failedAttempts >= MAX_FAILED_ATTEMPTS,
    remainingSeconds: getRemainingLockoutSeconds()
  };
}

/**
 * Resets failed attempts after successful authentication.
 */
function resetFailedAttempts() {
  failedAttempts = 0;
  lockoutUntil = 0;
}

/**
 * Generates an HMAC signed token with timestamp for authenticated sessions.
 * @param {string} pin
 * @returns {string}
 */
function generateToken(pin) {
  const payload = `${pin}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

/**
 * Validates a session token including signature and 24-hour expiration.
 * @param {string} token
 * @returns {boolean}
 */
function validateToken(token) {
  const config = loadConfig();
  if (!config.pin) return true;
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 3) return false;

    const pin = parts[0];
    const timestamp = Number(parts[1]);
    const hmac = parts.slice(2).join(':');

    // 1. PIN equality check
    if (pin !== String(config.pin)) return false;

    // 2. Token expiration check (max 24h, allow 1 minute future clock skew)
    const age = Date.now() - timestamp;
    if (isNaN(timestamp) || age > MAX_TOKEN_AGE_MS || age < -60000) {
      return false;
    }

    // 3. Timing-safe HMAC verification
    const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET).update(`${pin}:${timestamp}`).digest('hex');
    const expectedBuf = Buffer.from(expectedHmac, 'utf8');
    const actualBuf = Buffer.from(hmac, 'utf8');

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch (_) {
    return false;
  }
}

module.exports = {
  loadConfig,
  generateToken,
  validateToken,
  recordFailedAttempt,
  resetFailedAttempts,
  isRateLimited,
  getRemainingLockoutSeconds,
  MAX_TOKEN_AGE_MS,
  MAX_FAILED_ATTEMPTS
};
