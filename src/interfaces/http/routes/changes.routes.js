const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { getActiveWorkspaceRoot } = require('../../../infrastructure/workspace/resolver');

function createChangesRoutes({ reviewChangesUseCase, onChangesBroadcast }) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    const root = getActiveWorkspaceRoot();
    const changes = await reviewChangesUseCase.getChanges(root);
    res.json(changes);
  });

  router.post('/accept', requireAuth, async (req, res) => {
    const root = getActiveWorkspaceRoot();
    const { file } = req.body || {};
    const result = file
      ? await reviewChangesUseCase.acceptFile(root, file)
      : await reviewChangesUseCase.acceptAll(root);
    if (typeof onChangesBroadcast === 'function') {
      onChangesBroadcast();
    }
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  router.post('/reject', requireAuth, async (req, res) => {
    const root = getActiveWorkspaceRoot();
    const { file } = req.body || {};
    const result = file
      ? await reviewChangesUseCase.rejectFile(root, file)
      : await reviewChangesUseCase.rejectAll(root);
    if (typeof onChangesBroadcast === 'function') {
      onChangesBroadcast();
    }
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  router.get('/staged', requireAuth, async (req, res) => {
    try {
      const root = getActiveWorkspaceRoot();
      const [stagedChanges, branchInfo, suggestedMessage] = await Promise.all([
        reviewChangesUseCase.getStagedChanges(root),
        reviewChangesUseCase.getBranchInfo(root),
        reviewChangesUseCase.getCommitSuggestion(root)
      ]);

      res.json({
        staged: stagedChanges,
        branch: branchInfo,
        suggestedMessage
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/commit', requireAuth, async (req, res) => {
    try {
      const root = getActiveWorkspaceRoot();
      const { message, push = true, remote, branch } = req.body || {};

      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Commit message is required.' });
      }

      const result = await reviewChangesUseCase.commitChanges(root, {
        message: message.trim(),
        push: Boolean(push),
        remote,
        branch
      });

      if (typeof onChangesBroadcast === 'function') {
        onChangesBroadcast();
      }

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createChangesRoutes };
