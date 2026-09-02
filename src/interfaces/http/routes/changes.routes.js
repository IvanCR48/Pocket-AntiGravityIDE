const express = require('express');
const { requireAuth } = require('../../../infrastructure/security/pin-auth');
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
    const result = await reviewChangesUseCase.acceptAll(root);
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
    const result = await reviewChangesUseCase.rejectAll(root);
    if (typeof onChangesBroadcast === 'function') {
      onChangesBroadcast();
    }
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  return router;
}

module.exports = { createChangesRoutes };
