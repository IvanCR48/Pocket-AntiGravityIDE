const { injectText } = require('./clipboard-injector');
const { injectMedia } = require('./media-injector');

class PromptQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.isAgentBusy = false;
  }

  /**
   * Adds a prompt task to the queue and triggers processing if idle.
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
   * Updates agent busy state (e.g. from TranscriptWatcher log activity).
   * @param {boolean} busy
   */
  setAgentBusy(busy) {
    const wasBusy = this.isAgentBusy;
    this.isAgentBusy = busy;
    if (wasBusy && !busy) {
      // Agent finished writing, process next queued prompt if any
      setTimeout(() => this.checkAndProcess(), 300);
    }
  }

  async checkAndProcess() {
    if (this.isProcessing || this.isAgentBusy || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { item, resolve } = this.queue.shift();

    try {
      console.log(`[PromptQueue] Injecting prompt (Pending: ${this.queue.length})...`);
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
        setTimeout(() => this.checkAndProcess(), 400);
      }
    }
  }

  getPendingCount() {
    return this.queue.length;
  }
}

module.exports = PromptQueue;
