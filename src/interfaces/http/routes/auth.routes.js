const express = require('express');
const {
  loadConfig,
  generateToken,
  isRateLimited,
  recordFailedAttempt,
  resetFailedAttempts,
  getRemainingLockoutSeconds,
  MAX_FAILED_ATTEMPTS
} = require('../../../infrastructure/security/pin-auth');

function createAuthRoutes() {
  const router = express.Router();

  router.get('/status', (req, res) => {
    const config = loadConfig();
    res.json({
      authRequired: Boolean(config.pin),
      isRateLimited: isRateLimited(),
      remainingLockoutSeconds: getRemainingLockoutSeconds()
    });
  });

  router.post('/verify', (req, res) => {
    if (isRateLimited()) {
      const remaining = getRemainingLockoutSeconds();
      return res.status(429).json({
        success: false,
        isLocked: true,
        error: `Too many failed attempts. Try again in ${remaining} seconds.`
      });
    }

    const config = loadConfig();
    const inputPin = String(req.body.pin || '').trim();

    if (!config.pin || inputPin === String(config.pin)) {
      resetFailedAttempts();
      const token = generateToken(config.pin || 'OPEN');
      return res.json({
        success: true,
        token
      });
    }

    const attempt = recordFailedAttempt();
    if (attempt.isLocked) {
      return res.status(429).json({
        success: false,
        isLocked: true,
        error: `Too many failed attempts. Locked for ${attempt.remainingSeconds} seconds.`
      });
    }

    return res.status(401).json({
      success: false,
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - attempt.failedAttempts,
      error: `Incorrect PIN. Access denied (${MAX_FAILED_ATTEMPTS - attempt.failedAttempts} attempts left).`
    });
  });

  return router;
}

module.exports = { createAuthRoutes };
