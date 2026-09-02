const express = require('express');
const { requireAuth } = require('../../../infrastructure/security/pin-auth');

function createSessionsRoutes({ manageSessionsUseCase, getActiveSessionId, setActiveSessionId }) {
  const router = express.Router();

  router.get('/', requireAuth, (req, res) => {
    const sessions = manageSessionsUseCase.listSessions();
    res.json({ sessions, activeConversationId: getActiveSessionId() });
  });

  router.get('/:id', requireAuth, async (req, res) => {
    const id = req.params.id;
    const messages = await manageSessionsUseCase.readTranscript(id);
    res.json({ conversationId: id, messages });
  });

  router.post('/switch', requireAuth, (req, res) => {
    const { conversationId } = req.body;
    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversationId parameter.' });
    }

    setActiveSessionId(conversationId);
    res.json({ success: true, activeConversationId: conversationId });
  });

  router.post('/new', requireAuth, async (req, res) => {
    const result = await manageSessionsUseCase.startNewSession();
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    setActiveSessionId('NEW_PENDING_SESSION');
    res.json({
      success: true,
      activeConversationId: 'NEW_PENDING_SESSION'
    });
  });

  return router;
}

module.exports = { createSessionsRoutes };
