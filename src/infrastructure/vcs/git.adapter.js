const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { VcsPort } = require('../../core/ports/vcs.port');
const { FileDiff, WorkspaceChanges } = require('../../core/domain/change');

class GitAdapter extends VcsPort {
  runGit(args, cwd) {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
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

  async rejectAll(workspaceRoot) {
    try {
      await this.runGit(['restore', '.'], workspaceRoot);
      await this.runGit(['clean', '-fd'], workspaceRoot);
      return { success: true, message: 'All changes reverted.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = { GitAdapter };
