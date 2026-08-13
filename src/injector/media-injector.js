const { execFile } = require('child_process');
const path = require('path');

const PS_SCRIPT_PATH = path.join(__dirname, 'media-injector.ps1');

/**
 * Focuses Antigravity IDE, places image, file, or text onto clipboard, pastes (Ctrl+V) and submits (Enter).
 * @param {Object} options
 * @param {string} [options.imagePath=""] - Path to image file (PNG/JPG/WebP/BMP).
 * @param {string} [options.filePath=""] - Path to code/data file.
 * @param {string} [options.text=""] - Prompt text caption.
 * @param {string} [options.targetTitle="Antigravity"]
 * @param {string} [options.processName="Antigravity IDE"]
 * @param {number} [options.focusDelayMs=500]
 * @param {number} [options.pasteDelayMs=300]
 * @param {boolean} [options.submitEnter=true]
 * @returns {Promise<{success: boolean, hwnd: string, pid: number, title: string, imagePath: string, filePath: string, text: string, error: string|null}>}
 */
function injectMedia(options = {}) {
  const {
    imagePath = '',
    filePath = '',
    text = '',
    targetTitle = 'Antigravity',
    processName = 'Antigravity IDE',
    focusDelayMs = 500,
    pasteDelayMs = 300,
    submitEnter = true
  } = options;

  return new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT_PATH,
      '-ImagePath', imagePath,
      '-FilePath', filePath,
      '-Text', text,
      '-TargetTitle', targetTitle,
      '-ProcessName', processName,
      '-FocusDelayMs', String(focusDelayMs),
      '-PasteDelayMs', String(pasteDelayMs)
    ];

    if (!submitEnter) {
      args.push('-SendEnter:$false');
    }

    execFile('powershell.exe', args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        return resolve({
          success: false,
          hwnd: '0x0',
          pid: 0,
          title: '',
          imagePath,
          filePath,
          text,
          error: `Execution error: ${error.message}`
        });
      }

      try {
        const trimmed = stdout.trim();
        const jsonMatch = trimmed.match(/\{.*\}$/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return resolve({
            success: Boolean(parsed.Success),
            hwnd: parsed.HWND || '0x0',
            pid: parsed.PID || 0,
            title: parsed.Title || '',
            imagePath: parsed.ImagePath || imagePath,
            filePath: parsed.FilePath || filePath,
            text: parsed.Text || text,
            error: parsed.Error || null
          });
        }
        resolve({
          success: false,
          hwnd: '0x0',
          pid: 0,
          title: '',
          imagePath,
          filePath,
          text,
          error: `Unexpected output: ${trimmed || stderr}`
        });
      } catch (parseErr) {
        resolve({
          success: false,
          hwnd: '0x0',
          pid: 0,
          title: '',
          imagePath,
          filePath,
          text,
          error: `JSON parse error: ${parseErr.message}. Raw output: ${stdout}`
        });
      }
    });
  });
}

module.exports = { injectMedia };
