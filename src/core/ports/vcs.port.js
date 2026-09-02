/**
 * Port (Interface) for Version Control System interactions (Git/etc.).
 */
class VcsPort {
  async getChanges(workspaceRoot) {
    throw new Error('Method not implemented.');
  }

  async acceptAll(workspaceRoot) {
    throw new Error('Method not implemented.');
  }

  async rejectAll(workspaceRoot) {
    throw new Error('Method not implemented.');
  }
}

module.exports = { VcsPort };
