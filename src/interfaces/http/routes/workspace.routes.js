const express = require('express');
const { requireAuth } = require('../../../infrastructure/security/pin-auth');
const { getWorkspaceTree, getWorkspaceFileContent } = require('../../../infrastructure/workspace/explorer');
const { getActiveWorkspaceRoot } = require('../../../infrastructure/workspace/resolver');

function createWorkspaceRoutes() {
  const router = express.Router();

  router.get('/tree', requireAuth, (req, res) => {
    const root = getActiveWorkspaceRoot();
    const tree = getWorkspaceTree(root);
    res.json({ workspaceRoot: root, tree });
  });

  router.get('/file', requireAuth, (req, res) => {
    const relPath = req.query.path;
    if (!relPath) {
      return res.status(400).json({ error: 'Missing path parameter.' });
    }

    const root = getActiveWorkspaceRoot();
    const fileData = getWorkspaceFileContent(root, relPath);
    if (fileData.success) {
      res.json(fileData);
    } else {
      res.status(400).json(fileData);
    }
  });

  return router;
}

module.exports = { createWorkspaceRoutes };
