const fs = require('fs');
const path = require('path');

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
 * @param {string} rootDir - Workspace root path
 * @param {string} [currentDir=rootDir] - Current subfolder path
 * @returns {Array<Object>}
 */
function getWorkspaceTree(rootDir, currentDir = rootDir) {
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
          path: relativePath,
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
          path: relativePath,
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
 * Reads file content safely for workspace file viewer.
 * @param {string} rootDir - Workspace root path
 * @param {string} relativePath - File relative path
 * @returns {{success: boolean, content?: string, size?: number, error?: string}}
 */
function getWorkspaceFileContent(rootDir, relativePath) {
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
    return { success: true, content, size: stat.size };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getWorkspaceTree,
  getWorkspaceFileContent
};
