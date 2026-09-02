const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'pocket.config.json');
const SERVER_SECRET = crypto.randomBytes(32).toString('hex');

/**
 * Loads or reloads configuration from pocket.config.json or environment.
 * @returns {{pin: string, port: number}}
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

  return config;
}

/**
 * Creates a signed auth token.
 * @param {string} pin
 * @returns {string}
 */
function generateToken(pin) {
  const payload = `${pin}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

/**
 * Validates a session token.
 * @param {string} token
 * @returns {boolean}
 */
function validateToken(token) {
  const config = loadConfig();
  // If PIN is not configured or empty, access is open
  if (!config.pin) return true;
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [pin, timestamp, hmac] = decoded.split(':');
    if (pin !== String(config.pin)) return false;

    const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET).update(`${pin}:${timestamp}`).digest('hex');
    return hmac === expectedHmac;
  } catch (_) {
    return false;
  }
}

/**
 * Express middleware to protect API routes.
 */
function requireAuth(req, res, next) {
  const config = loadConfig();
  if (!config.pin) {
    return next(); // Auth disabled
  }

  const authHeader = req.headers['authorization'] || req.headers['x-pocket-token'] || req.query.token;
  let token = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = String(authHeader).trim();
    }
  }

  if (validateToken(token)) {
    return next();
  }

  return res.status(401).json({
    success: false,
    authRequired: true,
    error: 'Unauthorized: Invalid or missing security PIN.'
  });
}

module.exports = {
  loadConfig,
  generateToken,
  validateToken,
  requireAuth
};
