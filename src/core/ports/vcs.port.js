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

  async acceptFile(workspaceRoot, filePath) {
    throw new Error('Method not implemented.');
  }

  async rejectAll(workspaceRoot) {
    throw new Error('Method not implemented.');
  }

  async rejectFile(workspaceRoot, filePath) {
    throw new Error('Method not implemented.');
  }

  async getStagedChanges(workspaceRoot) {
    throw new Error('Method not implemented.');
  }

  async getBranchInfo(workspaceRoot) {
    throw new Error('Method not implemented.');
  }

  async commit(workspaceRoot, message) {
    throw new Error('Method not implemented.');
  }

  async push(workspaceRoot, remote, branch) {
    throw new Error('Method not implemented.');
  }
}

module.exports = { VcsPort };
