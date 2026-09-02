const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { WORKSPACE_ROOT } = require('./explorer');
const { loadConfig } = require('../auth/auth');

/**
 * Resolves the active workspace root directory.
 * - If pocket.config.json defines a specific path, uses that.
 * - If pocket.config.json sets workspaceRoot: "auto", detects recent workspace from Antigravity IDE.
 * - Default: current project root (WORKSPACE_ROOT).
 * @returns {string}
 */
function getActiveWorkspaceRoot() {
  const config = loadConfig();
  if (config.workspaceRoot && config.workspaceRoot !== 'auto' && fs.existsSync(config.workspaceRoot)) {
    return path.resolve(config.workspaceRoot);
  }

  if (config.workspaceRoot === 'auto') {
    try {
      const storageDir = path.join(process.env.APPDATA || '', 'Antigravity IDE', 'User', 'workspaceStorage');
      if (fs.existsSync(storageDir)) {
        const folders = fs.readdirSync(storageDir);
        let candidates = [];

        for (const f of folders) {
          const wsFile = path.join(storageDir, f, 'workspace.json');
          if (fs.existsSync(wsFile)) {
            try {
              const stat = fs.statSync(wsFile);
              const data = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
              if (data.folder && data.folder.startsWith('file:')) {
                let decoded = decodeURIComponent(data.folder.replace(/^file:\/\/\/?/, ''));
                decoded = decoded.replace(/^([a-zA-Z])%3A/i, '$1:');
                if (fs.existsSync(decoded)) {
                  const isGit = fs.existsSync(path.join(decoded, '.git'));
                  candidates.push({ folder: path.resolve(decoded), mtime: stat.mtimeMs, isGit });
                }
              }
            } catch (_) {}
          }
        }

        candidates.sort((a, b) => b.mtime - a.mtime);
        const gitCandidate = candidates.find(c => c.isGit);
        if (gitCandidate) return gitCandidate.folder;
        if (candidates.length > 0) return candidates[0].folder;
      }
    } catch (err) {
      console.warn('[DiffEngine] Could not detect auto workspace:', err.message);
    }
  }

  return WORKSPACE_ROOT;
}

/**
 * Helper to run git command in workspace directory.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<string>}
 */
function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Parses unified git diff into structured file chunks.
 * @param {string} rawDiff
 * @returns {Array<{file: string, diff: string, additions: number, deletions: number}>}
 */
function parseUnifiedDiff(rawDiff) {
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
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    fileDiffs.push({
      file: fileName,
      diff: part,
      additions,
      deletions
    });
  }

  return fileDiffs;
}

/**
 * Gets all modified, added, and deleted files with stats and unified diffs.
 * @returns {Promise<{hasChanges: boolean, workspaceRoot: string, summary: {files: number, additions: number, deletions: number}, files: Array}>}
 */
async function getWorkspaceChanges() {
  const rootDir = getActiveWorkspaceRoot();

  try {
    const statusOutput = await runGit(['status', '--porcelain'], rootDir);
    if (!statusOutput) {
      return {
        hasChanges: false,
        workspaceRoot: rootDir,
        summary: { files: 0, additions: 0, deletions: 0 },
        files: []
      };
    }

    const rawDiff = await runGit(['diff', '-U3'], rootDir).catch(() => '');
    const parsedDiffs = parseUnifiedDiff(rawDiff);

    // Also collect untracked new files
    const statusLines = statusOutput.split('\n').filter(Boolean);
    const untrackedFiles = [];

    for (const line of statusLines) {
      const status = line.substring(0, 2).trim();
      const filePath = line.substring(3).trim().replace(/^"|"$/g, '');

      if (status === '??') {
        let content = '';
        let additions = 0;
        try {
          const fullPath = path.join(rootDir, filePath);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.size < 200000) {
            content = fs.readFileSync(fullPath, 'utf8');
            additions = content.split('\n').length;
          }
        } catch (_) {}

        untrackedFiles.push({
          file: filePath,
          status: 'untracked',
          diff: content ? `@@ -0,0 +1,${additions} @@\n` + content.split('\n').map(l => `+${l}`).join('\n') : '',
          additions,
          deletions: 0
        });
      }
    }

    const allFiles = [...parsedDiffs.map(d => ({ ...d, status: 'modified' })), ...untrackedFiles];

    let totalAdditions = 0;
    let totalDeletions = 0;
    allFiles.forEach(f => {
      totalAdditions += f.additions;
      totalDeletions += f.deletions;
    });

    return {
      hasChanges: allFiles.length > 0,
      workspaceRoot: rootDir,
      summary: {
        files: allFiles.length,
        additions: totalAdditions,
        deletions: totalDeletions
      },
      files: allFiles
    };
  } catch (err) {
    return {
      hasChanges: false,
      workspaceRoot: rootDir,
      error: err.message,
      summary: { files: 0, additions: 0, deletions: 0 },
      files: []
    };
  }
}

/**
 * Reverts all unstaged working tree changes and deletes untracked files.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function rejectAllChanges() {
  const rootDir = getActiveWorkspaceRoot();

  try {
    await runGit(['restore', '.'], rootDir);
    await runGit(['clean', '-fd'], rootDir);
    console.log(`[DiffEngine] All changes discarded in ${rootDir}`);
    return { success: true, message: 'All changes successfully discarded.' };
  } catch (err) {
    console.error(`[DiffEngine] Error rejecting changes:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Accepts all changes by triggering Win32 Alt+Enter in Antigravity IDE and staging in git.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function acceptAllChanges() {
  const rootDir = getActiveWorkspaceRoot();

  try {
    try {
      const { triggerIdeAccept } = require('../injector/diff-acceptor');
      await triggerIdeAccept();
    } catch (_) {}

    await runGit(['add', '.'], rootDir);
    console.log(`[DiffEngine] All changes accepted and staged in ${rootDir}`);
    return { success: true, message: 'All changes successfully accepted.' };
  } catch (err) {
    console.error(`[DiffEngine] Error accepting changes:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getActiveWorkspaceRoot,
  getWorkspaceChanges,
  rejectAllChanges,
  acceptAllChanges
};
