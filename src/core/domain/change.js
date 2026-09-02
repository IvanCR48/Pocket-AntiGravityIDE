/**
 * Domain entity representing a file change/diff in the working tree.
 */
class FileDiff {
  constructor({ file, diff, additions = 0, deletions = 0, status = 'modified' }) {
    this.file = file;
    this.diff = diff;
    this.additions = Number(additions) || 0;
    this.deletions = Number(deletions) || 0;
    this.status = status; // 'modified' | 'untracked' | 'deleted'
  }
}

class WorkspaceChanges {
  constructor({ workspaceRoot, files = [] }) {
    this.workspaceRoot = workspaceRoot;
    this.files = files.map(f => f instanceof FileDiff ? f : new FileDiff(f));
    this.hasChanges = this.files.length > 0;
    this.summary = {
      files: this.files.length,
      additions: this.files.reduce((acc, f) => acc + f.additions, 0),
      deletions: this.files.reduce((acc, f) => acc + f.deletions, 0)
    };
  }
}

module.exports = { FileDiff, WorkspaceChanges };
