const { execFile } = require('child_process');
const path = require('path');

const PS_SCRIPT_PATH = path.join(__dirname, 'clipboard-injector.ps1');

/**
 * Focuses Antigravity IDE, copies prompt text to system clipboard, pastes (Ctrl+V) and submits (Enter).
 * @param {Object} options
 * @param {string} [options.text=""] - The prompt text to inject.
 * @param {string} [options.targetTitle="Antigravity IDE"]
 * @param {string} [options.processName="Antigravity IDE"]
 * @param {number} [options.focusDelayMs=400]
 * @param {number} [options.pasteDelayMs=250]
 * @param {boolean} [options.submitEnter=true]
 * @param {string} [options.focusShortcut="Auto"] - "Auto", "Ctrl+L", "Ctrl+Shift+I", "None"
 * @param {string} [options.method="keybd_event"] - "keybd_event" or "SendKeys"
 * @param {boolean} [options.newChat=false] - Whether to trigger New Chat command
 * @returns {Promise<{success: boolean, hwnd: string, pid: number, title: string, textInjected: string, error: string|null}>}
 */
function injectText(options = {}) {
  const {
    text = '',
    targetTitle = 'Antigravity IDE',
    processName = 'Antigravity IDE',
    focusDelayMs = 400,
    pasteDelayMs = 250,
    submitEnter = true,
    focusShortcut = 'Auto',
    method = 'keybd_event',
    newChat = false
  } = options;

  return new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT_PATH,
      '-Text', text,
      '-TargetTitle', targetTitle,
      '-ProcessName', processName,
      '-FocusDelayMs', String(focusDelayMs),
      '-PasteDelayMs', String(pasteDelayMs),
      '-FocusShortcut', focusShortcut,
      '-Method', method
    ];

    if (!submitEnter) {
      args.push('-SendEnter:$false');
    }

    if (newChat) {
      args.push('-NewChat');
    }

    execFile('powershell.exe', args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        return resolve({
          success: false,
          hwnd: '0x0',
          pid: 0,
          title: '',
          textInjected: text,
          error: `Execution error: ${error.message}`
        });
      }

      try {
        const trimmed = (stdout || '').trim();
        const jsonMatch = trimmed.match(/\{.*\}$/s);
        if (jsonMatch) {
          // Replace raw unescaped newlines/tabs inside string values before parsing
          const cleanJson = jsonMatch[0].replace(/[\r\n\t]+/g, ' ');
          const parsed = JSON.parse(cleanJson);
          return resolve({
            success: Boolean(parsed.Success),
            hwnd: parsed.HWND || '0x0',
            pid: parsed.PID || 0,
            title: parsed.Title || '',
            textInjected: parsed.TextInjected || text,
            error: parsed.Error || null
          });
        }
        resolve({
          success: false,
          hwnd: '0x0',
          pid: 0,
          title: '',
          textInjected: text,
          error: `Unexpected output: ${trimmed || stderr}`
        });
      } catch (parseErr) {
        resolve({
          success: false,
          hwnd: '0x0',
          pid: 0,
          title: '',
          textInjected: text,
          error: `JSON parse error: ${parseErr.message}. Raw output: ${stdout}`
        });
      }
    });
  });
}

module.exports = { injectText };
