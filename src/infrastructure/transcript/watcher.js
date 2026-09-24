// Lector de streaming para los logs de Antigravity.
// Cero scraping de pantalla ni extensiones invasivas: Antigravity vuelca todo su razonamiento
// en un transcript.jsonl en disco. Nos colgamos de ese archivo para retransmitir los pasos en vivo al celular.
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { DEFAULT_BRAIN_DIR, listSessions } = require('./reader');

class TranscriptWatcher {
  constructor(options = {}) {
    this.brainDir = options.brainDir || DEFAULT_BRAIN_DIR;
    this.onNewStep = options.onNewStep || (() => {});
    this.activeConversationId = null;
    this.watcher = null;
    this.filePosition = 0;
  }

  start(conversationId = null) {
    if (conversationId) {
      this.activeConversationId = conversationId;
    } else {
      const sessions = listSessions(this.brainDir);
      if (sessions.length > 0) {
        this.activeConversationId = sessions[0].id;
      }
    }

    if (!this.activeConversationId) {
      console.log("[Watcher] No active conversation found to watch.");
      return;
    }

    const transcriptPath = path.join(
      this.brainDir,
      this.activeConversationId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    console.log(`[Watcher] Watching transcript log: ${transcriptPath}`);

    // Si la conversación ya tiene historia, clavamos el puntero al final del archivo.
    // No queremos bombardear al celular con los 200 mensajes viejos que ya ocurrieron.
    if (fs.existsSync(transcriptPath)) {
      this.filePosition = fs.statSync(transcriptPath).size;
    } else {
      this.filePosition = 0;
    }

    if (this.watcher) {
      this.watcher.close();
    }

    // En Windows, los eventos nativos de ReadDirectoryChangesW a veces se duermen
    // con archivos que se abren en modo append muy rápido. Polling de 300ms nunca falla.
    this.watcher = chokidar.watch(transcriptPath, {
      persistent: true,
      usePolling: true,
      interval: 300
    });

    this.watcher.on('change', () => this.readNewLines(transcriptPath));
  }

  readNewLines(filePath) {
    try {
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);
      if (stats.size <= this.filePosition) return;

      // EL TRUCO QUE SALVA LA CPU:
      // Un transcript.jsonl puede llegar a pesar 50 MB en una sesión larga.
      // Si leyéramos todo el archivo en cada actualización, la máquina del usuario empezaría a despegar.
      // Abrimos el stream únicamente desde this.filePosition hasta stats.size para digerir solo lo nuevo.
      const stream = fs.createReadStream(filePath, {
        start: this.filePosition,
        end: stats.size,
        encoding: 'utf8'
      });

      let leftover = '';

      stream.on('data', (chunk) => {
        const text = leftover + chunk;
        const lines = text.split('\n');
        leftover = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            this.onNewStep(this.activeConversationId, parsed);
          } catch (_) {}
        }
      });

      stream.on('end', () => {
        this.filePosition = stats.size;
      });
    } catch (err) {
      console.error("[Watcher] Error reading new lines:", err);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = TranscriptWatcher;
