const express = require('express');
const { loadConfig, generateToken } = require('../../../auth/auth');

function createAuthRoutes() {
  const router = express.Router();

  router.get('/status', (req, res) => {
    const config = loadConfig();
    res.json({
      authRequired: Boolean(config.pin)
    });
  });

  router.post('/verify', (req, res) => {
    const config = loadConfig();
    const inputPin = String(req.body.pin || '').trim();

    if (!config.pin || inputPin === String(config.pin)) {
      const token = generateToken(config.pin || 'OPEN');
      return res.json({
        success: true,
        token
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Incorrect PIN. Access denied.'
    });
  });

  return router;
}

module.exports = { createAuthRoutes };
