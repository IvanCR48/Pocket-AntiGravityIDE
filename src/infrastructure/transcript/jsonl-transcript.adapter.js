const { TranscriptPort } = require('../../core/ports/transcript.port');
const { Session } = require('../../core/domain/session');
const { listSessions, readTranscript, DEFAULT_BRAIN_DIR } = require('./reader');
const TranscriptWatcher = require('./watcher');

class JsonlTranscriptAdapter extends TranscriptPort {
  constructor(brainDir = DEFAULT_BRAIN_DIR) {
    super();
    this.brainDir = brainDir;
    this.watcher = null;
  }

  listSessions() {
    const rawSessions = listSessions(this.brainDir);
    return rawSessions.map(s => new Session({ id: s.id, mtime: s.mtime }));
  }

  async readTranscript(conversationId) {
    return await readTranscript(conversationId, this.brainDir);
  }

  watchSession(conversationId, onStep) {
    if (!this.watcher) {
      this.watcher = new TranscriptWatcher({
        brainDir: this.brainDir,
        onNewStep: (convId, stepData) => {
          if (typeof onStep === 'function') {
            onStep(convId, stepData);
          }
        }
      });
    }
    this.watcher.start(conversationId);
  }
}

module.exports = { JsonlTranscriptAdapter, DEFAULT_BRAIN_DIR };
