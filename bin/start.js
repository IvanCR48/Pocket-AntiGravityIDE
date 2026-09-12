const { spawn } = require('child_process');
const path = require('path');
const { getLogoBanner, box, COLORS, rgb, BOLD, RESET, DIM } = require('../src/infrastructure/terminal/theme');

console.clear();
console.log('\n' + getLogoBanner() + '\n');

console.log(box([
  `🚀 ${BOLD}POCKET ANTIGRAVITY — HOST LAUNCHER${RESET}`,
  `${DIM}Starting Hexagonal Server & Encrypted Access Tunnel...${RESET}`
], { title: 'HOST LAUNCHER', borderColor: COLORS.blurple }));

console.log('');

console.log(`${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[1/2]')} Launching Pocket Antigravity Server...`);
spawn('cmd.exe', ['/c', 'start', 'Pocket Antigravity Server', 'node', 'src/server.js'], {
  detached: true,
  stdio: 'ignore'
}).unref();

setTimeout(() => {
  console.log(`${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[2/2]')} Launching Global Access Tunnel...`);
  spawn('cmd.exe', ['/c', 'start', 'Pocket Antigravity Tunnel', 'node', 'bin/start-tunnel.js'], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  console.log('\n' + box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ Pocket Antigravity is running!')}`,
    ``,
    `1. ${BOLD}Server Terminal:${RESET}  http://localhost:3000`,
    `2. ${BOLD}Host Dashboard:${RESET}   ${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], 'http://localhost:3000/dashboard')}`,
    `3. ${BOLD}Tunnel Terminal:${RESET}  Generating phone QR code...`
  ], { title: 'ONLINE', borderColor: COLORS.neonGreen }) + '\n');

  console.log(`${DIM}You can safely close this launcher window. Services will continue running.${RESET}\n`);
  setTimeout(() => process.exit(0), 2000);
}, 1500);
