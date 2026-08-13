const { execSync } = require('child_process');

try {
  const output = execSync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Select-Object -First 5 | ConvertTo-Json"', { encoding: 'utf8' });
  console.log("PS Output:");
  console.log(output);
} catch (err) {
  console.error("PS Error:", err);
}
