/**
 * Domain entity representing an Assistant Persona.
 */
class Persona {
  constructor({ id, name, icon, description, systemPromptPrefix = '', slashCommand = null }) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.description = description;
    this.systemPromptPrefix = systemPromptPrefix.trim();
    this.slashCommand = slashCommand;
  }

  /**
   * Applies the persona directives to the user prompt.
   * @param {string} text - Raw user prompt text.
   * @returns {string} Enriched prompt with role context.
   */
  applyToPrompt(text) {
    const raw = (text || '').trim();

    let prefix = '';
    if (this.slashCommand && !raw.startsWith('/')) {
      prefix += `${this.slashCommand} `;
    }

    if (this.systemPromptPrefix) {
      prefix += `[Role Directive: ${this.systemPromptPrefix}]\n\n`;
    }

    return `${prefix}${raw}`.trim();
  }
}

/**
 * Built-in curated catalog of developer personas.
 */
const BUILT_IN_PERSONAS = [
  new Persona({
    id: 'pair',
    name: 'Pair Dev',
    icon: '⚡',
    description: 'Standard pair programmer: direct, concise, high quality code.',
    systemPromptPrefix: 'Act as an expert pair programmer. Provide clean, production-ready code directly without unnecessary conversational filler.'
  }),
  new Persona({
    id: 'reviewer',
    name: 'Reviewer',
    icon: '🔍',
    description: 'Code auditor: hunts edge cases, bugs, security vulnerabilities, and code smells.',
    systemPromptPrefix: 'Act as a Senior Code Reviewer & Security Auditor. Thoroughly analyze edge cases, performance pitfalls, security risks, and code smells. Be critical and rigorous.'
  }),
  new Persona({
    id: 'architect',
    name: 'Architect',
    icon: '📐',
    description: 'Software Architect: designs modular, clean, scalable decoupled architectures.',
    systemPromptPrefix: 'Act as a Principal Software Architect. Focus on Clean/Hexagonal Architecture, separation of concerns, interfaces, contracts, domain boundaries, and long-term scalability.'
  }),
  new Persona({
    id: 'debugger',
    name: 'Bug Hunter',
    icon: '🐛',
    description: 'Methodical debugger: isolates root cause, adds reproduction logs, and surgical fixes.',
    systemPromptPrefix: 'Act as a Senior Debugging Specialist. Methodically isolate the root cause, verify assumptions, trace stack errors, and provide a minimal, verified fix.'
  }),
  new Persona({
    id: 'goal',
    name: 'Autonomous Goal',
    icon: '🎯',
    description: 'Long-running autonomous execution using the /goal command.',
    slashCommand: '/goal',
    systemPromptPrefix: 'Run as a thorough autonomous engineer. Do not stop until the entire objective is fully implemented and validated.'
  }),
  new Persona({
    id: 'explainer',
    name: 'Teacher',
    icon: '💡',
    description: 'Senior mentor: explains the why, architectural tradeoffs, and mental models.',
    systemPromptPrefix: 'Act as a Senior Tech Mentor. Explain the fundamental reasons, tradeoffs, and concepts clearly with analogies and code snippets.'
  })
];

module.exports = {
  Persona,
  BUILT_IN_PERSONAS
};
