const { execSync } = require('child_process');

try {
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.ProcessName -like '*Antigravity*' -or $_.ProcessName -like '*electron*' } | Select-Object Id, ProcessName, MainWindowHandle, MainWindowTitle | ConvertTo-Json"`;
  const res = execSync(cmd, { encoding: 'utf8' });
  console.log("Antigravity Processes:", res);
} catch (e) {
  console.error("Error:", e.message);
}
