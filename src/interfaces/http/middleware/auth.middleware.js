const { loadConfig, validateToken } = require('../../../infrastructure/security/pin-auth');

/**
 * Express middleware to enforce PIN authentication on protected HTTP routes.
 */
function requireAuth(req, res, next) {
  const config = loadConfig();
  if (!config.pin) return next();

  const authHeader = req.headers['authorization'] || req.headers['x-pocket-token'] || req.query.token;
  let token = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = String(authHeader).trim();
    }
  }

  if (validateToken(token)) return next();

  return res.status(401).json({
    success: false,
    authRequired: true,
    error: 'Unauthorized: Invalid or expired security PIN session.'
  });
}

module.exports = { requireAuth };
