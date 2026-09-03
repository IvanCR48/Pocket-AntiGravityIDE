const fs = require('fs');
const path = require('path');
const { Persona, BUILT_IN_PERSONAS } = require('../domain/persona');

const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'pocket.config.json');

/**
 * Use case: Manages assistant personas, custom role prompts, and persona resolution.
 */
class ManagePersonasUseCase {
  constructor() {
    this.customPersonas = this.loadCustomPersonas();
  }

  loadCustomPersonas() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.personas)) {
          return parsed.personas.map(p => new Persona(p));
        }
      }
    } catch (_) {}
    return [];
  }

  getPersonas() {
    return [...BUILT_IN_PERSONAS, ...this.customPersonas];
  }

  getPersonaById(id) {
    const all = this.getPersonas();
    return all.find(p => p.id === id) || BUILT_IN_PERSONAS[0];
  }

  saveCustomPersona({ name, icon = '🤖', description = '', systemPromptPrefix = '', slashCommand = null }) {
    if (!name || !name.trim()) {
      return { success: false, error: 'Persona name is required.' };
    }

    const id = `custom_${Date.now()}`;
    const newPersona = new Persona({
      id,
      name: name.trim(),
      icon: icon.trim() || '🤖',
      description: description.trim(),
      systemPromptPrefix: systemPromptPrefix.trim(),
      slashCommand: slashCommand ? slashCommand.trim() : null
    });

    this.customPersonas.push(newPersona);

    try {
      let config = {};
      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
      config.personas = this.customPersonas;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
      return { success: true, persona: newPersona };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = { ManagePersonasUseCase };
