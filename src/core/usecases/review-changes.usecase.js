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

  async acceptFile(workspaceRoot, filePath) {
    // Note: Do not trigger IDE-wide acceptFocusedHunk here, as that sends Alt+Enter
    // which globally accepts all pending files across the entire workspace in Antigravity IDE.
    // Individual card acceptance strictly stages only the specific file via VCS.
    return await this.vcs.acceptFile(workspaceRoot, filePath);
  }

  async rejectAll(workspaceRoot) {
    return await this.vcs.rejectAll(workspaceRoot);
  }

  async rejectFile(workspaceRoot, filePath) {
    return await this.vcs.rejectFile(workspaceRoot, filePath);
  }

  async getStagedChanges(workspaceRoot) {
    return await this.vcs.getStagedChanges(workspaceRoot);
  }

  async getBranchInfo(workspaceRoot) {
    return await this.vcs.getBranchInfo(workspaceRoot);
  }

  async getCommitSuggestion(workspaceRoot) {
    const staged = await this.vcs.getStagedChanges(workspaceRoot);
    if (typeof this.vcs.generateSuggestedCommitMessage === 'function') {
      return this.vcs.generateSuggestedCommitMessage(staged.files);
    }
    return 'feat: update staged files';
  }

  async commitChanges(workspaceRoot, { message, push = false, remote = 'origin', branch } = {}) {
    const commitResult = await this.vcs.commit(workspaceRoot, message);
    if (!commitResult.success) {
      return commitResult;
    }

    if (push) {
      const pushResult = await this.vcs.push(workspaceRoot, remote, branch);
      return {
        ...commitResult,
        pushed: pushResult.success,
        pushOutput: pushResult.output || pushResult.error
      };
    }

    return {
      ...commitResult,
      pushed: false
    };
  }
}

module.exports = { ReviewChangesUseCase };
