const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { DEFAULT_BRAIN_DIR, listSessions } = require('./reader');

class TranscriptWatcher {
  /**
   * @param {Object} options
   * @param {string} [options.brainDir]
   * @param {Function} [options.onNewStep]
   */
  constructor(options = {}) {
    this.brainDir = options.brainDir || DEFAULT_BRAIN_DIR;
    this.onNewStep = options.onNewStep || (() => {});
    this.activeConversationId = null;
    this.watcher = null;
    this.filePosition = 0;
  }

  start(conversationId = null) {
    if (conversationId) {
      this.activeConversationId = conversationId;
    } else {
      const sessions = listSessions(this.brainDir);
      if (sessions.length > 0) {
        this.activeConversationId = sessions[0].id;
      }
    }

    if (!this.activeConversationId) {
      console.log("[Watcher] No active conversation found to watch.");
      return;
    }

    const transcriptPath = path.join(
      this.brainDir,
      this.activeConversationId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    console.log(`[Watcher] Watching transcript log: ${transcriptPath}`);

    if (fs.existsSync(transcriptPath)) {
      this.filePosition = fs.statSync(transcriptPath).size;
    } else {
      this.filePosition = 0;
    }

    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = chokidar.watch(transcriptPath, {
      persistent: true,
      usePolling: true,
      interval: 300
    });

    this.watcher.on('change', () => this.readNewLines(transcriptPath));
  }

  readNewLines(filePath) {
    try {
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);
      if (stats.size <= this.filePosition) return;

      const stream = fs.createReadStream(filePath, {
        start: this.filePosition,
        end: stats.size,
        encoding: 'utf8'
      });

      let leftover = '';

      stream.on('data', (chunk) => {
        const text = leftover + chunk;
        const lines = text.split('\n');
        leftover = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            this.onNewStep(this.activeConversationId, parsed);
          } catch (_) {}
        }
      });

      stream.on('end', () => {
        this.filePosition = stats.size;
      });
    } catch (err) {
      console.error("[Watcher] Error reading new lines:", err);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = TranscriptWatcher;
