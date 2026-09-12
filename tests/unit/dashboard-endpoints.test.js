const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const path = require('path');
const { SystemDoctor } = require('../../src/infrastructure/system/doctor');
const { TunnelManager } = require('../../src/infrastructure/system/tunnel-manager');
const { createSystemRoutes } = require('../../src/interfaces/http/routes/system.routes');

test('System Routes & Dashboard Endpoints', async (t) => {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  const doctor = new SystemDoctor();
  const tunnel = new TunnelManager();

  app.use('/api/system', createSystemRoutes({
    systemDoctor: doctor,
    tunnelManager: tunnel,
    getActiveSessionId: () => 'test-session-123',
    getClientCount: () => 2
  }));

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'dashboard', 'index.html'));
  });

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => server.close());

  await t.test('serves desktop dashboard HTML', async () => {
    const res = await fetch(`${baseUrl}/dashboard`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Host Control Center'));
    assert.ok(text.includes('System Doctor'));
  });

  await t.test('serves web app manifest.json', async () => {
    const res = await fetch(`${baseUrl}/manifest.json`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.short_name, 'Pocket IDE');
    assert.strictEqual(data.display, 'standalone');
  });

  await t.test('serves service worker sw.js', async () => {
    const res = await fetch(`${baseUrl}/sw.js`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('pocket-ide-shell'));
  });

  await t.test('returns system diagnostics JSON from /api/system/doctor', async () => {
    const res = await fetch(`${baseUrl}/api/system/doctor`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.node);
    assert.ok(data.git);
    assert.ok(data.powershell);
  });

  await t.test('returns reachable network interfaces from /api/system/network', async () => {
    const res = await fetch(`${baseUrl}/api/system/network`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.primaryUrl);
    assert.ok(Array.isArray(data.lanUrls));
  });

  await t.test('generates dynamic SVG QR code from /api/system/qr', async () => {
    const res = await fetch(`${baseUrl}/api/system/qr?text=${encodeURIComponent('http://192.168.1.8:3000')}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('image/svg+xml'));
    const svg = await res.text();
    assert.ok(svg.includes('<svg'));
  });

  await t.test('returns live stats telemetry from /api/system/stats', async () => {
    const res = await fetch(`${baseUrl}/api/system/stats`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.activeConversationId, 'test-session-123');
    assert.strictEqual(data.clientCount, 2);
  });
});
