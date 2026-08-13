const { execFile } = require('child_process');
const path = require('path');

const PS_SCRIPT_PATH = path.join(__dirname, 'window-finder.ps1');

/**
 * Finds and focuses the target IDE window using native Win32 APIs via PowerShell.
 * @param {Object} options
 * @param {string} [options.targetTitle="Antigravity"]
 * @param {string} [options.processName="Antigravity IDE"]
 * @returns {Promise<{success: boolean, pid: number, hwnd: string, title: string, processName: string, error: string|null}>}
 */
function focusWindow(options = {}) {
  const { targetTitle = 'Antigravity', processName = 'Antigravity IDE' } = options;

  return new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT_PATH,
      '-TargetTitle', targetTitle,
      '-ProcessName', processName
    ];

    execFile('powershell.exe', args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        return resolve({
          success: false,
          pid: 0,
          hwnd: '0x0',
          title: '',
          processName: '',
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
            pid: parsed.PID || 0,
            hwnd: parsed.HWND || '0x0',
            title: parsed.Title || '',
            processName: parsed.ProcessName || '',
            error: parsed.Error || null
          });
        }
        resolve({
          success: false,
          pid: 0,
          hwnd: '0x0',
          title: '',
          processName: '',
          error: `Unexpected output: ${trimmed || stderr}`
        });
      } catch (parseErr) {
        resolve({
          success: false,
          pid: 0,
          hwnd: '0x0',
          title: '',
          processName: '',
          error: `JSON parse error: ${parseErr.message}. Raw output: ${stdout}`
        });
      }
    });
  });
}

module.exports = { focusWindow };
