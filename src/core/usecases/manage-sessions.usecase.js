/**
 * Use case: Manages conversation sessions, reads transcripts, and creates new chats.
 */
class ManageSessionsUseCase {
  constructor({ transcriptPort, ideAutomationPort }) {
    this.transcript = transcriptPort;
    this.ideAutomation = ideAutomationPort;
  }

  listSessions() {
    return this.transcript.listSessions();
  }

  async readTranscript(conversationId) {
    return await this.transcript.readTranscript(conversationId);
  }

  watchSession(conversationId, onStep) {
    this.transcript.watchSession(conversationId, onStep);
  }

  async startNewSession() {
    return await this.ideAutomation.startNewConversation();
  }
}

module.exports = { ManageSessionsUseCase };
