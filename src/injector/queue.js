const { injectText } = require('./clipboard-injector');
const { injectMedia } = require('./media-injector');

class PromptQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Adds a prompt task to the queue and triggers processing.
   * @param {Object} item
   * @returns {Promise<Object>}
   */
  enqueue(item) {
    return new Promise((resolve) => {
      this.queue.push({ item, resolve });
      this.checkAndProcess();
    });
  }

  /**
   * Legacy helper kept for compatibility.
   */
  setAgentBusy(busy) {
    // Non-blocking
  }

  async checkAndProcess() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { item, resolve } = this.queue.shift();

    try {
      console.log(`[PromptQueue] Injecting prompt (Remaining in queue: ${this.queue.length})...`);
      let result;
      if (item.uploadedImage || item.filePath) {
        result = await injectMedia({
          imagePath: item.uploadedImage,
          filePath: item.filePath,
          text: item.text,
          targetTitle: 'Antigravity IDE',
          processName: 'Antigravity IDE',
          focusDelayMs: 400,
          pasteDelayMs: 250,
          submitEnter: true
        });
      } else {
        result = await injectText({
          text: item.text,
          targetTitle: 'Antigravity IDE',
          processName: 'Antigravity IDE',
          focusDelayMs: 400,
          pasteDelayMs: 250,
          submitEnter: true,
          focusShortcut: item.focusShortcut || 'Auto',
          method: item.method || 'keybd_event',
          newChat: Boolean(item.newChat)
        });
      }

      resolve(result);
    } catch (err) {
      console.error('[PromptQueue] Injection error:', err.message);
      resolve({ success: false, error: err.message });
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setTimeout(() => this.checkAndProcess(), 300);
      }
    }
  }

  getPendingCount() {
    return this.queue.length;
  }
}

module.exports = PromptQueue;
