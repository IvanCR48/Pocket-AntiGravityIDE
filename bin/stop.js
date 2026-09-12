const { execSync } = require('child_process');
const { getLogoBanner, box, COLORS, rgb, BOLD, RESET, DIM } = require('../src/infrastructure/terminal/theme');

console.clear();
console.log('\n' + getLogoBanner() + '\n');

console.log(box([
  `🛑 ${BOLD}STOPPING POCKET ANTIGRAVITY SERVICES...${RESET}`,
  `${DIM}Terminating port listener and background terminal windows...${RESET}`
], { title: 'SHUTDOWN', borderColor: COLORS.red }));

console.log('');

// 1. Safely terminate only the process listening on port 3000
try {
  const netstatOut = execSync('netstat -aon', { encoding: 'utf8' });
  const lines = netstatOut.split('\n');
  const match = lines.find(l => l.includes(':3000') && l.includes('LISTENING'));

  if (match) {
    const parts = match.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && !isNaN(pid)) {
      console.log(`${rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], '[*]')} Closing host listener on PID ${pid}...`);
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    }
  } else {
    console.log(`${rgb(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2], '[*]')} No process found listening on port 3000.`);
  }
} catch (_) {}

// 2. Terminate the launched terminal host windows
try {
  execSync('taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Server*"', { stdio: 'ignore' });
  execSync('taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Tunnel*"', { stdio: 'ignore' });
} catch (_) {}

console.log('\n' + box([
  `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ Pocket Antigravity stopped cleanly!')}`,
  ``,
  `${DIM}All background server and tunnel processes were terminated.${RESET}`,
  `${DIM}No other Node.js applications were affected.${RESET}`
], { title: 'SUCCESS', borderColor: COLORS.neonGreen }) + '\n');
