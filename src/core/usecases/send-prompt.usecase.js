const { Prompt } = require('../domain/prompt');

/**
 * Use case: Validates and queues a prompt to be injected into Antigravity IDE.
 */
class SendPromptUseCase {
  constructor(ideAutomationPort) {
    this.ideAutomation = ideAutomationPort;
  }

  async execute(promptData) {
    const prompt = new Prompt(promptData);
    if (!prompt.isValid()) {
      return { success: false, error: 'Must provide prompt text, image upload, or file path.' };
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
