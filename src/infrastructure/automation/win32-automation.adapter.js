const { IdeAutomationPort } = require('../../core/ports/ide-automation.port');
const PromptQueue = require('./queue');
const { getChatState } = require('./check-chat-state');
const { triggerIdeAccept } = require('./diff-acceptor');

/**
 * Windows Win32 OS automation adapter implementing IdeAutomationPort.
 */
class Win32AutomationAdapter extends IdeAutomationPort {
  constructor() {
    super();
    this.queue = new PromptQueue();
  }

  async sendPrompt(prompt) {
    return await this.queue.enqueue({
      text: prompt.text,
      filePath: prompt.filePath,
      uploadedImage: prompt.uploadedImage,
      focusShortcut: prompt.focusShortcut,
      method: prompt.method,
      newChat: false
    });
  }

  async startNewConversation() {
    return await this.queue.enqueue({
      newChat: true
    });
  }

  async acceptFocusedHunk() {
    return await triggerIdeAccept();
  }

  async getChatState() {
    return await getChatState();
  }

  getPendingQueueCount() {
    return this.queue.getPendingCount();
  }
}

module.exports = { Win32AutomationAdapter };
