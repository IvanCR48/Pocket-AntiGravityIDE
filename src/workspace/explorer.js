const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || path.resolve(__dirname, '..', '..');

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.gemini',
  'uploads',
  'dist',
  'build',
  '.tmp',
  '.vs',
  '.vscode'
]);

/**
 * Recursively scans directory and builds a tree structure of workspace files.
 * @param {string} [rootDir=WORKSPACE_ROOT] - Workspace root path
 * @param {string} [currentDir=rootDir] - Current subfolder path
 * @returns {Array<Object>}
 */
function getWorkspaceTree(rootDir = WORKSPACE_ROOT, currentDir = rootDir) {
  const items = [];

  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (DEFAULT_IGNORE.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = getWorkspaceTree(rootDir, fullPath);
        items.push({
          name: entry.name,
          relativePath: relativePath,
          type: 'directory',
          children
        });
      } else if (entry.isFile()) {
        let size = 0;
        try {
          size = fs.statSync(fullPath).size;
        } catch (_) {}

        items.push({
          name: entry.name,
          relativePath: relativePath,
          type: 'file',
          size
        });
      }
    }
  } catch (err) {
    console.error(`[Explorer] Error scanning directory ${currentDir}:`, err.message);
  }

  // Sort directories first, then files alphabetically
  return items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

/**
 * Maps file extension to highlight language.
 * @param {string} filename
 * @returns {string}
 */
function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.json': 'json',
    '.ps1': 'powershell',
    '.cs': 'csharp',
    '.html': 'html',
    '.css': 'css',
    '.md': 'markdown',
    '.bat': 'bat',
    '.cmd': 'bat',
    '.py': 'python',
    '.sh': 'bash'
  };
  return map[ext] || 'plaintext';
}

/**
 * Reads file content safely for workspace file viewer.
 * @param {string} [rootDir=WORKSPACE_ROOT] - Workspace root path
 * @param {string} relativePath - File relative path
 * @returns {{success: boolean, content?: string, size?: number, language?: string, error?: string}}
 */
function getWorkspaceFileContent(rootDir = WORKSPACE_ROOT, relativePath = '') {
  try {
    const fullPath = path.resolve(rootDir, relativePath);
    // Security check: ensure path is inside rootDir
    if (!fullPath.startsWith(path.resolve(rootDir))) {
      return { success: false, error: 'Access denied: Path outside workspace.' };
    }

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File not found.' };
    }

    const stat = fs.statSync(fullPath);
    if (stat.size > 500000) { // Limit to 500 KB for mobile viewer
      return { success: false, error: `File too large (${(stat.size / 1024).toFixed(1)} KB). Max size is 500 KB.` };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const language = detectLanguage(relativePath);

    return { success: true, content, size: stat.size, language };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  WORKSPACE_ROOT,
  getWorkspaceTree,
  getWorkspaceFileContent
};
