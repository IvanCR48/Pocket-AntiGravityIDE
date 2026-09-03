const { Prompt } = require('../domain/prompt');

/**
 * Use case: Validates, enriches with Persona directives, and queues a prompt to be injected into Antigravity IDE.
 */
class SendPromptUseCase {
  constructor(ideAutomationPort, managePersonasUseCase = null) {
    this.ideAutomation = ideAutomationPort;
    this.managePersonas = managePersonasUseCase;
  }

  async execute(promptData) {
    const prompt = new Prompt(promptData);
    if (!prompt.isValid()) {
      return { success: false, error: 'Must provide prompt text, image upload, or file path.' };
    }

    // Apply active persona context if available
    if (this.managePersonas && prompt.text && !prompt.newChat) {
      const persona = this.managePersonas.getPersonaById(prompt.personaId);
      if (persona) {
        prompt.text = persona.applyToPrompt(prompt.text);
      }
    }

    const result = await this.ideAutomation.sendPrompt(prompt);
    return {
      success: result.success,
      pendingInQueue: this.ideAutomation.getPendingQueueCount(),
      result
    };
  }
}

module.exports = { SendPromptUseCase };
