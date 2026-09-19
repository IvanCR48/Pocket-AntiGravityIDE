const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth.middleware');
const { DEFAULT_BRAIN_DIR } = require('../../../infrastructure/transcript/reader');
const { getActiveWorkspaceRoot } = require('../../../infrastructure/workspace/resolver');

function createSessionsRoutes({ manageSessionsUseCase, getActiveSessionId, setActiveSessionId }) {
  const router = express.Router();

  router.get('/', requireAuth, (req, res) => {
    const sessions = manageSessionsUseCase.listSessions();
    res.json({ sessions, activeConversationId: getActiveSessionId() });
  });

  router.get('/:id/artifact', requireAuth, (req, res) => {
    const rawPath = req.query.path || req.query.name || req.query.file;
    if (!rawPath) {
      return res.status(400).json({ success: false, error: 'Missing path or name parameter.' });
    }

    const convId = req.params.id === 'active' ? getActiveSessionId() : req.params.id;
    let cleanPath = decodeURIComponent(rawPath).trim();

    // Strip file:/// or file:// protocol
    if (cleanPath.startsWith('file:///')) {
      cleanPath = cleanPath.slice(8);
    } else if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.slice(7);
    }

    // Windows drive normalization: /C:/ -> C:/
    if (/^\/[a-zA-Z]:/.test(cleanPath)) {
      cleanPath = cleanPath.slice(1);
    }

    cleanPath = path.normalize(cleanPath);

    let targetFile = null;
    const candidates = [];

    // 1. Direct absolute path if exists
    if (path.isAbsolute(cleanPath) && fs.existsSync(cleanPath)) {
      candidates.push(cleanPath);
    }

    // 2. Search inside session brain directory
    if (convId && convId !== 'NEW_PENDING_SESSION') {
      candidates.push(path.join(DEFAULT_BRAIN_DIR, convId, path.basename(cleanPath)));
      candidates.push(path.join(DEFAULT_BRAIN_DIR, convId, cleanPath));
    }

    // 3. Search inside active workspace root
    const workspaceRoot = getActiveWorkspaceRoot();
    if (workspaceRoot) {
      candidates.push(path.join(workspaceRoot, cleanPath));
      candidates.push(path.join(workspaceRoot, path.basename(cleanPath)));
    }

    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          targetFile = cand;
          break;
        }
      } catch (_) {}
    }

    if (!targetFile) {
      return res.status(404).json({
        success: false,
        error: `Artifact not found: ${path.basename(cleanPath)}`
      });
    }

    try {
      const stat = fs.statSync(targetFile);
      if (stat.size > 2 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Artifact too large to preview (>2MB).' });
      }

      const content = fs.readFileSync(targetFile, 'utf8');
      const baseName = path.basename(targetFile);
      const isPlan = baseName.toLowerCase().includes('plan') ||
                     content.includes('# Implementation Plan') ||
                     content.includes('User Review Required');

      res.json({
        success: true,
        fileName: baseName,
        fullPath: targetFile,
        isPlan,
        language: path.extname(targetFile).toLowerCase() === '.md' ? 'markdown' : 'plaintext',
        content
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
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

