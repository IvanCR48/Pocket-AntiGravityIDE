/**
 * Port (Interface) for IDE OS-level automation and window control.
 * Can be implemented by Win32Adapter, MacOSAdapter, or MockAdapter.
 */
class IdeAutomationPort {
  async sendPrompt(prompt) {
    throw new Error('Method not implemented.');
  }

  async startNewConversation() {
    throw new Error('Method not implemented.');
  }

  async acceptFocusedHunk() {
    throw new Error('Method not implemented.');
  }

  async getChatState() {
    throw new Error('Method not implemented.');
  }

  getPendingQueueCount() {
    throw new Error('Method not implemented.');
  }
}

module.exports = { IdeAutomationPort };
