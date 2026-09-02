/**
 * Port (Interface) for Brain transcript logging and session persistence.
 */
class TranscriptPort {
  listSessions() {
    throw new Error('Method not implemented.');
  }

  async readTranscript(conversationId) {
    throw new Error('Method not implemented.');
  }

  watchSession(conversationId, onStep) {
    throw new Error('Method not implemented.');
  }
}

module.exports = { TranscriptPort };
