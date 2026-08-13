const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const workerExe = path.join(__dirname, 'chat-state-worker.exe');

let workerProc = null;
let pendingResolves = [];
let buffer = '';

function startWorker() {
  if (!fs.existsSync(workerExe)) {
    console.warn('[ChatStateWorker] Executable not found at:', workerExe);
    return null;
  }

  try {
    workerProc = spawn(workerExe, ['Antigravity IDE', 'Antigravity IDE'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    workerProc.stdout.on('data', (data) => {
      buffer += data.toString('utf8');
      let lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete trailing line in buffer

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (pendingResolves.length > 0) {
          const resolve = pendingResolves.shift();
          try {
            const parsed = JSON.parse(line);
            resolve({
              windowFound: Boolean(parsed.windowFound),
              isWindowForeground: Boolean(parsed.isWindowForeground),
              isChatOpen: Boolean(parsed.isChatOpen),
              isChatFocused: Boolean(parsed.isChatFocused),
              stateString: parsed.stateString || 'CLOSED'
            });
          } catch (err) {
            resolve({
              windowFound: false,
              isWindowForeground: false,
              isChatOpen: false,
              isChatFocused: false,
              stateString: 'CLOSED'
            });
          }
        }
      }
    });

    workerProc.stderr.on('data', (data) => {
      console.error('[ChatStateWorker Stderr]:', data.toString());
    });

    workerProc.on('exit', (code) => {
      console.warn(`[ChatStateWorker] Exited with code ${code}. Cleaning up worker.`);
      workerProc = null;
      // Reject any pending requests
      while (pendingResolves.length > 0) {
        const resolve = pendingResolves.shift();
        resolve({
          windowFound: false,
          isWindowForeground: false,
          isChatOpen: false,
          isChatFocused: false,
          stateString: 'CLOSED'
        });
      }
    });

    return workerProc;
  } catch (err) {
    console.error('[ChatStateWorker] Failed to spawn worker:', err.message);
    workerProc = null;
    return null;
  }
}

/**
 * Gets the live chat state in sub-millisecond time via persistent C# worker process IPC.
 * @returns {Promise<{windowFound: boolean, isWindowForeground: boolean, isChatOpen: boolean, isChatFocused: boolean, stateString: string}>}
 */
function getChatState() {
  return new Promise((resolve) => {
    if (!workerProc) {
      startWorker();
    }

    if (!workerProc || !workerProc.stdin.writable) {
      return resolve({
        windowFound: false,
        isWindowForeground: false,
        isChatOpen: false,
        isChatFocused: false,
        stateString: 'CLOSED'
      });
    }

    // Push promise resolver to queue and write request to worker stdin
    pendingResolves.push(resolve);
    workerProc.stdin.write('CHECK\n');

    // Timeout safety net (2000ms max)
    setTimeout(() => {
      const idx = pendingResolves.indexOf(resolve);
      if (idx !== -1) {
        pendingResolves.splice(idx, 1);
        resolve({
          windowFound: false,
          isWindowForeground: false,
          isChatOpen: false,
          isChatFocused: false,
          stateString: 'CLOSED'
        });
      }
    }, 2000);
  });
}

// Start worker immediately on module load
startWorker();

module.exports = { getChatState };
