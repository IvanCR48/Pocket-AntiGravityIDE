const express = require('express');
const { requireAuth } = require('../../../infrastructure/security/pin-auth');

function createPersonasRoutes({ managePersonasUseCase }) {
  const router = express.Router();

  router.get('/', requireAuth, (req, res) => {
    const personas = managePersonasUseCase.getPersonas();
    res.json({ personas });
  });

  router.post('/custom', requireAuth, (req, res) => {
    const { name, icon, description, systemPromptPrefix, slashCommand } = req.body;
    const result = managePersonasUseCase.saveCustomPersona({
      name,
      icon,
      description,
      systemPromptPrefix,
      slashCommand
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  return router;
}

module.exports = { createPersonasRoutes };
