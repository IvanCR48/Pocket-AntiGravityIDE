const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { createSessionsRoutes } = require('../../src/interfaces/http/routes/sessions.routes');
const { Session } = require('../../src/core/domain/session');
const { generateToken } = require('../../src/infrastructure/security/pin-auth');

test('Sessions Routes & Auto-Switch Detection', async (t) => {
  let activeSessionId = 'session-1';
  const knownSessionIds = new Set(['session-1', 'session-2']);

  const mockSessions = [
    new Session({ id: 'session-1', mtime: new Date('2026-09-21T10:00:00Z') }),
    new Session({ id: 'session-2', mtime: new Date('2026-09-21T09:00:00Z') })
  ];

  const mockManageSessionsUseCase = {
    listSessions: () => mockSessions,
    readTranscript: async (id) => [
      { role: 'user', content: `Hello in ${id}` },
      { role: 'assistant', content: `Response in ${id}` }
    ],
    startNewSession: async () => ({ success: true })
  };

  const app = express();
  app.use(express.json());

  app.use('/api/sessions', createSessionsRoutes({
    manageSessionsUseCase: mockManageSessionsUseCase,
    getActiveSessionId: () => activeSessionId,
    setActiveSessionId: (newId) => {
      activeSessionId = newId;
      if (newId && newId !== 'NEW_PENDING_SESSION') {
        knownSessionIds.add(newId);
      }
    }
  }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const validToken = generateToken('1234');

  t.after(() => server.close());

  await t.test('GET /api/sessions returns sessions list and activeConversationId', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.activeConversationId, 'session-1');
    assert.strictEqual(data.sessions.length, 2);
    assert.strictEqual(data.sessions[0].id, 'session-1');
  });

  await t.test('POST /api/sessions/switch updates active conversation ID to an older chat', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`
      },
      body: JSON.stringify({ conversationId: 'session-2' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.activeConversationId, 'session-2');
    assert.strictEqual(activeSessionId, 'session-2');
  });

  await t.test('Auto-detect logic preserves manual switch even when sessions[0] has newer mtime', () => {
    // Simulate auto-detect loop logic from server.js
    const sessions = mockManageSessionsUseCase.listSessions();
    const brandNewSession = sessions.find((s) => !knownSessionIds.has(s.id));

    // Because session-1 and session-2 are already in knownSessionIds, brandNewSession is undefined
    assert.strictEqual(brandNewSession, undefined);
    // Active session remains session-2 (the user's manual selection)
    assert.strictEqual(activeSessionId, 'session-2');
  });

  await t.test('POST /api/sessions/new sets active conversation ID to NEW_PENDING_SESSION', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.activeConversationId, 'NEW_PENDING_SESSION');
    assert.strictEqual(activeSessionId, 'NEW_PENDING_SESSION');

    // Polling loop does not reset NEW_PENDING_SESSION if no new session folder exists yet
    const sessions = mockManageSessionsUseCase.listSessions();
    const brandNewSession = sessions.find((s) => !knownSessionIds.has(s.id));
    assert.strictEqual(brandNewSession, undefined);
    assert.strictEqual(activeSessionId, 'NEW_PENDING_SESSION');
  });

  await t.test('Auto-detect logic switches only when a genuinely brand-new session appears', () => {
    // Simulate new session created on disk (from PC or mobile first prompt)
    const brandNewId = 'session-3-brand-new';
    mockSessions.unshift(new Session({ id: brandNewId, mtime: new Date('2026-09-21T11:00:00Z') }));

    const sessions = mockManageSessionsUseCase.listSessions();
    const brandNewSession = sessions.find((s) => !knownSessionIds.has(s.id));

    assert.ok(brandNewSession);
    assert.strictEqual(brandNewSession.id, brandNewId);

    // When detected:
    knownSessionIds.add(brandNewSession.id);
    activeSessionId = brandNewSession.id;

    assert.strictEqual(activeSessionId, brandNewId);
  });
});
