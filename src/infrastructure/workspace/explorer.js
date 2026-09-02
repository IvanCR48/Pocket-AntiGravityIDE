const fs = require('fs');
const path = require('path');
const { DEFAULT_WORKSPACE_ROOT } = require('./resolver');

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.gemini',
  '.vscode',
  'dist',
  'build',
  'coverage',
  '.system_generated'
]);

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.md': 'markdown',
    '.py': 'python',
    '.ps1': 'powershell',
    '.sh': 'bash',
    '.bat': 'batch',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql'
  };
  return map[ext] || 'plaintext';
}

function getWorkspaceTree(rootDir, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];

  const items = [];
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(rootDir, entry.name);
      const relativePath = path.relative(DEFAULT_WORKSPACE_ROOT, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          type: 'directory',
          relativePath,
          children: getWorkspaceTree(fullPath, maxDepth, currentDepth + 1)
        });
      } else if (entry.isFile()) {
        items.push({
          name: entry.name,
          type: 'file',
          relativePath,
          language: detectLanguage(fullPath)
        });
      }
    }
  } catch (err) {
    console.warn(`[WorkspaceExplorer] Error reading directory ${rootDir}:`, err.message);
  }

  // Sort directories first, then alphabetically
  return items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

function getWorkspaceFileContent(rootDir, relativePath) {
  try {
    const safeRelPath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(rootDir, safeRelPath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File not found.' };
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return { success: false, error: 'Path is not a regular file.' };
    }

    if (stat.size > 500 * 1024) {
      return { success: false, error: 'File too large to preview (>500KB).' };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      success: true,
      relativePath: safeRelPath.replace(/\\/g, '/'),
      language: detectLanguage(fullPath),
      content
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getWorkspaceTree,
  getWorkspaceFileContent,
  detectLanguage,
  WORKSPACE_ROOT: DEFAULT_WORKSPACE_ROOT
};
