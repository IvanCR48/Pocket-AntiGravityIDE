const { spawn } = require('child_process');
const path = require('path');

/**
 * Triggers native Alt+Enter hunk acceptance in Antigravity IDE via Win32.
 * @returns {Promise<{success: boolean, message?: string}>}
 */
function triggerIdeAccept() {
  return new Promise((resolve) => {
    const psScript = path.join(__dirname, 'diff-acceptor.ps1');
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psScript
    ]);

    let output = '';
    child.stdout.on('data', (d) => output += d.toString());
    child.stderr.on('data', (d) => output += d.toString());

    child.on('close', (code) => {
      console.log(`[DiffAcceptor] PowerShell finished (code ${code}): ${output.trim()}`);
      resolve({ success: code === 0, message: output.trim() });
    });
  });
}

module.exports = { triggerIdeAccept };
