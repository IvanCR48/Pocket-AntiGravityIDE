const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createSessionsRoutes } = require('../../src/interfaces/http/routes/sessions.routes');
const { generateToken } = require('../../src/infrastructure/security/pin-auth');

test('Artifact & Plan Viewer Endpoint', async (t) => {
  const app = express();
  app.use(express.json());

  const mockManageSessions = {
    listSessions: () => [{ id: 'test-session-456', mtime: new Date() }],
    readTranscript: async () => []
  };

  app.use('/api/sessions', createSessionsRoutes({
    manageSessionsUseCase: mockManageSessions,
    getActiveSessionId: () => 'test-session-456',
    setActiveSessionId: () => {}
  }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const validToken = generateToken('1234');

  t.after(() => server.close());

  await t.test('returns 400 when path or name parameter is missing', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/active/artifact`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await t.test('returns 404 for nonexistent artifact', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/active/artifact?path=nonexistent_file_xyz_123.md`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Artifact not found'));
  });

  await t.test('successfully resolves existing workspace file as artifact', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/active/artifact?path=package.json`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.fileName, 'package.json');
    assert.ok(typeof data.content === 'string');
    assert.ok(data.content.includes('pocket-antigravity'));
  });

  await t.test('detects plan files and marks isPlan true', async () => {
    // Create temporary test plan in workspace
    const tempPlanPath = path.join(__dirname, '..', '..', 'temp_test_implementation_plan.md');
    fs.writeFileSync(tempPlanPath, '# Implementation Plan\n\n## User Review Required\nProceed?', 'utf8');

    try {
      const res = await fetch(`${baseUrl}/api/sessions/active/artifact?path=temp_test_implementation_plan.md`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.isPlan, true);
      assert.strictEqual(data.language, 'markdown');
      assert.ok(data.content.includes('User Review Required'));
    } finally {
      if (fs.existsSync(tempPlanPath)) fs.unlinkSync(tempPlanPath);
    }
  });
});
