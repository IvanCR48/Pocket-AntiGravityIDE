/**
 * Use case: Queries working tree diffs, accepts hunks via IDE/Git, or rolls back changes.
 */
class ReviewChangesUseCase {
  constructor({ vcsPort, ideAutomationPort }) {
    this.vcs = vcsPort;
    this.ideAutomation = ideAutomationPort;
  }

  async getChanges(workspaceRoot) {
    return await this.vcs.getChanges(workspaceRoot);
  }

  async acceptAll(workspaceRoot) {
    // 1. Trigger IDE UI hunk accept
    if (this.ideAutomation && typeof this.ideAutomation.acceptFocusedHunk === 'function') {
      try {
        await this.ideAutomation.acceptFocusedHunk();
      } catch (_) {}
    }

    // 2. Stage changes in Git
    return await this.vcs.acceptAll(workspaceRoot);
  }

  async rejectAll(workspaceRoot) {
    return await this.vcs.rejectAll(workspaceRoot);
  }
}

module.exports = { ReviewChangesUseCase };
