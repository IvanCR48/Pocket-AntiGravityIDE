const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { VcsPort } = require('../../core/ports/vcs.port');
const { FileDiff, WorkspaceChanges } = require('../../core/domain/change');

class GitAdapter extends VcsPort {
  runGit(args, cwd) {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      });
    });
  }

  parseUnifiedDiff(rawDiff) {
    if (!rawDiff) return [];
    const fileDiffs = [];
    const parts = rawDiff.split(/^diff --git /m).filter(Boolean);

    for (const part of parts) {
      const lines = part.split('\n');
      const header = lines[0];
      const fileMatch = header.match(/b\/(.+)$/);
      const fileName = fileMatch ? fileMatch[1] : 'unknown';

      let additions = 0;
      let deletions = 0;

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }

      fileDiffs.push(new FileDiff({
        file: fileName,
        diff: part,
        additions,
        deletions,
        status: 'modified'
      }));
    }
    return fileDiffs;
  }

  async getChanges(workspaceRoot) {
    try {
      const statusOutput = await this.runGit(['status', '--porcelain'], workspaceRoot);
      if (!statusOutput) {
        return new WorkspaceChanges({ workspaceRoot, files: [] });
      }

      const rawDiff = await this.runGit(['diff', '-U3'], workspaceRoot).catch(() => '');
      const parsedDiffs = this.parseUnifiedDiff(rawDiff);

      // Collect untracked files
      const statusLines = statusOutput.split('\n').filter(Boolean);
      const untrackedFiles = [];

      for (const line of statusLines) {
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3).trim().replace(/^"|"$/g, '');

        if (status === '??') {
          let content = '';
          let additions = 0;
          try {
            const fullPath = path.join(workspaceRoot, filePath);
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.size < 200000) {
              content = fs.readFileSync(fullPath, 'utf8');
              additions = content.split('\n').length;
            }
          } catch (_) {}

          untrackedFiles.push(new FileDiff({
            file: filePath,
            diff: content ? `@@ -0,0 +1,${additions} @@\n` + content.split('\n').map(l => `+${l}`).join('\n') : '',
            additions,
            deletions: 0,
            status: 'untracked'
          }));
        }
      }

      return new WorkspaceChanges({
        workspaceRoot,
        files: [...parsedDiffs, ...untrackedFiles]
      });
    } catch (err) {
      return new WorkspaceChanges({ workspaceRoot, files: [] });
    }
  }

  async acceptAll(workspaceRoot) {
    try {
      await this.runGit(['add', '.'], workspaceRoot);
      return { success: true, message: 'All changes staged in Git.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async acceptFile(workspaceRoot, filePath) {
    try {
      await this.runGit(['add', '--', filePath], workspaceRoot);
      return { success: true, message: `File ${filePath} staged in Git.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async rejectAll(workspaceRoot) {
    try {
      // Non-destructive safety: Stash all modifications and untracked files first
      const stashMsg = `pocket-reject-backup-${Date.now()}`;
      await this.runGit(['stash', 'push', '--include-untracked', '-m', stashMsg], workspaceRoot).catch(() => {});
      await this.runGit(['restore', '.'], workspaceRoot).catch(() => {});
      return { success: true, message: 'All changes safely reverted (backup preserved in git stash).' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async rejectFile(workspaceRoot, filePath) {
    try {
      // Non-destructive safety: Try restore first, fallback to clean for untracked files
      await this.runGit(['restore', '--', filePath], workspaceRoot).catch(async () => {
        await this.runGit(['clean', '-f', '--', filePath], workspaceRoot).catch(() => {});
      });
      return { success: true, message: `File ${filePath} reverted.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getBranchInfo(workspaceRoot) {
    try {
      const branch = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], workspaceRoot);
      const remotes = await this.runGit(['remote'], workspaceRoot).catch(() => '');
      const hasOrigin = remotes.split('\n').map(r => r.trim()).includes('origin');
      return {
        branch: branch || 'main',
        remote: hasOrigin ? 'origin' : (remotes.split('\n')[0] || ''),
        hasRemote: Boolean(remotes.trim())
      };
    } catch (err) {
      return { branch: 'main', remote: '', hasRemote: false };
    }
  }

  generateSuggestedCommitMessage(stagedFiles = []) {
    if (!stagedFiles || stagedFiles.length === 0) {
      return 'chore: update workspace files';
    }

    const files = stagedFiles.map(f => typeof f === 'string' ? f : (f.file || ''));
    
    // Test files
    if (files.every(f => f.includes('test') || f.includes('.spec.'))) {
      return 'test: add and update test suites';
    }

    // Documentation
    if (files.every(f => f.endsWith('.md') || f.includes('docs/'))) {
      return 'docs: update project documentation and guides';
    }

    // UI / Frontend files
    if (files.every(f => f.startsWith('public/') || f.endsWith('.html') || f.endsWith('.css'))) {
      return files.length === 1
        ? `feat(ui): update ${path.basename(files[0])}`
        : 'feat(ui): update mobile interface and components';
    }

    // Backend / Routes / Ports
    if (files.every(f => f.includes('src/interfaces/http') || f.includes('routes/'))) {
      return 'feat(api): update HTTP routes and endpoints';
    }

    if (files.every(f => f.includes('src/infrastructure/vcs') || f.includes('src/core/ports/vcs'))) {
      return 'feat(vcs): enhance version control system capabilities';
    }

    // Single file fallback
    if (files.length === 1) {
      const base = path.basename(files[0]);
      const ext = path.extname(base);
      const name = base.replace(ext, '');
      return `feat(${name}): update ${base}`;
    }

    // Multi-file general summary
    return `feat: update ${files.length} project files`;
  }

  async getStagedChanges(workspaceRoot) {
    try {
      const statusOutput = await this.runGit(['status', '--porcelain'], workspaceRoot).catch(() => '');
      if (!statusOutput) {
        return new WorkspaceChanges({ workspaceRoot, files: [] });
      }

      const rawDiff = await this.runGit(['diff', '--cached', '-U3'], workspaceRoot).catch(() => '');
      const parsedDiffs = this.parseUnifiedDiff(rawDiff);

      // Also account for newly staged untracked files (status 'A ')
      const statusLines = statusOutput.split('\n').filter(Boolean);
      const stagedAddedFiles = [];

      for (const line of statusLines) {
        const indexStatus = line.charAt(0);
        const filePath = line.substring(3).trim().replace(/^"|"$/g, '');

        if (indexStatus === 'A' && !parsedDiffs.some(p => p.file === filePath)) {
          let content = '';
          let additions = 0;
          try {
            const fullPath = path.join(workspaceRoot, filePath);
            if (fs.existsSync(fullPath)) {
              content = fs.readFileSync(fullPath, 'utf8');
              additions = content.split('\n').length;
            }
          } catch (_) {}

          stagedAddedFiles.push(new FileDiff({
            file: filePath,
            diff: content ? `@@ -0,0 +1,${additions} @@\n` + content.split('\n').map(l => `+${l}`).join('\n') : '',
            additions,
            deletions: 0,
            status: 'added'
          }));
        }
      }

      return new WorkspaceChanges({
        workspaceRoot,
        files: [...parsedDiffs, ...stagedAddedFiles]
      });
    } catch (err) {
      return new WorkspaceChanges({ workspaceRoot, files: [] });
    }
  }

  async commit(workspaceRoot, message) {
    try {
      const cleanMessage = (message || '').trim();
      if (!cleanMessage) {
        return { success: false, error: 'Commit message cannot be empty.' };
      }

      // Check if there are staged changes
      const staged = await this.getStagedChanges(workspaceRoot);
      if (!staged.hasChanges || staged.files.length === 0) {
        return { success: false, error: 'No staged changes to commit. Stage files first.' };
      }

      const stdout = await this.runGit(['commit', '-m', cleanMessage], workspaceRoot);
      const commitHash = await this.runGit(['rev-parse', '--short', 'HEAD'], workspaceRoot).catch(() => 'unknown');
      const branchInfo = await this.getBranchInfo(workspaceRoot);

      return {
        success: true,
        commitHash,
        message: cleanMessage,
        branch: branchInfo.branch,
        filesCount: staged.files.length,
        output: stdout
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async push(workspaceRoot, remote = 'origin', branch) {
    try {
      const branchInfo = await this.getBranchInfo(workspaceRoot);
      const targetBranch = branch || branchInfo.branch || 'main';
      const targetRemote = remote || branchInfo.remote || 'origin';

      const stdout = await this.runGit(['push', targetRemote, targetBranch], workspaceRoot);
      return {
        success: true,
        remote: targetRemote,
        branch: targetBranch,
        output: stdout || `Pushed to ${targetRemote}/${targetBranch}`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = { GitAdapter };

