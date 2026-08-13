const { execSync } = require('child_process');
const fs = require('fs');

const cmd = `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json"`;

try {
  const out = execSync(cmd, { encoding: 'utf8' });
  console.log("Processes with MainWindowTitle:");
  console.log(out);
} catch (e) {
  console.error("Error:", e.message);
}
