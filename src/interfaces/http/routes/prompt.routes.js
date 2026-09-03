const express = require('express');
const { requireAuth } = require('../../../infrastructure/security/pin-auth');

function createPromptRoutes({ sendPromptUseCase, ideAutomationPort, upload }) {
  const router = express.Router();

  router.post('/send', requireAuth, upload.single('image'), async (req, res) => {
    const text = req.body.text || '';
    const filePath = req.body.filePath || '';
    const focusShortcut = req.body.focusShortcut || 'Auto';
    const method = req.body.method || 'keybd_event';
    const personaId = req.body.personaId || 'pair';
    const uploadedImage = req.file ? req.file.path : null;

    const result = await sendPromptUseCase.execute({
      text,
      filePath,
      uploadedImage,
      focusShortcut,
      method,
      personaId,
      newChat: false
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  router.get('/chat-state', requireAuth, async (req, res) => {
    const state = await ideAutomationPort.getChatState();
    res.json(state);
  });

  return router;
}

module.exports = { createPromptRoutes };
