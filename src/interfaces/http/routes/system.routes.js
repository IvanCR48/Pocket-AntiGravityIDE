const express = require('express');
const QRCode = require('qrcode');
const { loadConfig, saveConfig } = require('../../../infrastructure/security/pin-auth');

/**
 * Creates Express router for system diagnostics, network resolution, tunnel control, and settings.
 * Designed for the local Desktop Host Control Center.
 */
function createSystemRoutes({ systemDoctor, tunnelManager, getActiveSessionId, getClientCount }) {
  const router = express.Router();

  // Dynamic SVG QR code endpoint
  router.get('/qr', async (req, res) => {
    try {
      const text = req.query.text;
      if (!text) return res.status(400).send('Missing text query parameter');
      const svg = await QRCode.toString(text, {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#ffffff',
          light: '#00000000'
        }
      });
      res.type('image/svg+xml').send(svg);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Diagnostics & Doctor
  router.get('/doctor', async (req, res) => {
    try {
      const diagnostics = await systemDoctor.getDiagnostics();
      res.json(diagnostics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Local Network & Reachable Endpoints
  router.get('/network', (req, res) => {
    try {
      const config = loadConfig();
      const port = config.port || 3000;
      const network = systemDoctor.getNetworkInfo(port);
      res.json(network);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Tunnel Status
  router.get('/tunnel', (req, res) => {
    res.json(tunnelManager.getStatus());
  });

  // Start Public Tunnel
  router.post('/tunnel/start', async (req, res) => {
    try {
      const config = loadConfig();
      const port = config.port || 3000;
      const status = await tunnelManager.start(port);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stop Public Tunnel
  router.post('/tunnel/stop', (req, res) => {
    try {
      const status = tunnelManager.stop();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle PC Keep-Awake
  router.post('/power', (req, res) => {
    try {
      const { enable } = req.body;
      const active = systemDoctor.setKeepAwake(Boolean(enable));
      // Also persist preference in pocket.config.json
      saveConfig({ preventSleep: active });
      res.json({ active });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Configuration (Read)
  router.get('/config', (req, res) => {
    try {
      const config = loadConfig();
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Configuration (Update)
  router.post('/config', (req, res) => {
    try {
      const { pin, port, preventSleep, defaultPersona } = req.body;
      const updates = {};
      if (pin !== undefined) updates.pin = pin;
      if (port !== undefined) updates.port = port;
      if (preventSleep !== undefined) {
        updates.preventSleep = Boolean(preventSleep);
        systemDoctor.setKeepAwake(Boolean(preventSleep));
      }
      if (defaultPersona !== undefined) updates.defaultPersona = defaultPersona;

      const updated = saveConfig(updates);
      res.json({ success: true, config: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Live Server Stats
  router.get('/stats', (req, res) => {
    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      activeConversationId: getActiveSessionId ? getActiveSessionId() : null,
      clientCount: getClientCount ? getClientCount() : 0,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    });
  });

  return router;
}

module.exports = { createSystemRoutes };
