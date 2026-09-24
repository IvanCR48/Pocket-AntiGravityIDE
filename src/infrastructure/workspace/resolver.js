// Resolución automática del proyecto activo.
// A ningún desarrollador le gusta escribir rutas absolutas kilométricas de Windows a mano.
// Este módulo rastrea las entrañas de Antigravity para adivinar qué carpeta tienes abierta en el editor.
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../security/pin-auth');

const DEFAULT_WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

function getActiveWorkspaceRoot() {
  const config = loadConfig();
  if (config.workspaceRoot && config.workspaceRoot !== 'auto' && fs.existsSync(config.workspaceRoot)) {
    return path.resolve(config.workspaceRoot);
  }

  if (config.workspaceRoot === 'auto') {
    try {
      // Rastreamos el almacenamiento interno de sesiones de Antigravity en %APPDATA%.
      // Inspeccionamos los workspace.json más recientes: el que tenga mayor mtime y carpeta .git
      // es casi con 100% de certeza el repositorio en el que estás trabajando ahora mismo.
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
                // Chromium en Windows guarda las rutas como "file:///c%3A/Users/...".
                // Limpiamos los slashes y reemplazamos el %3A por dos puntos reales o fs.existsSync revienta.
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
      console.warn('[WorkspaceResolver] Auto-detection error:', err.message);
    }
  }

  return DEFAULT_WORKSPACE_ROOT;
}

module.exports = {
  getActiveWorkspaceRoot,
  DEFAULT_WORKSPACE_ROOT
};
