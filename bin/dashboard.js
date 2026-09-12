const { spawn, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { getLogoBanner, box, COLORS, rgb, BOLD, RESET, DIM } = require('../src/infrastructure/terminal/theme');

const PORT = process.env.PORT || 3000;
const DASHBOARD_URL = `http://localhost:${PORT}/dashboard`;

console.clear();
console.log('\n' + getLogoBanner() + '\n');

console.log(box([
  `🎛️  ${BOLD}POCKET ANTIGRAVITY — HOST CONTROL CENTER${RESET}`,
  `${DIM}Launching Desktop Control Center in windowed app mode...${RESET}`
], { title: 'DASHBOARD LAUNCHER', borderColor: COLORS.blurple }));

console.log('');

// Check if port 3000 is listening
function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function launch() {
  const isRunning = await isServerRunning(PORT);

  if (!isRunning) {
    console.log(`${rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], '[*]')} Starting background server on port ${PORT}...`);
    const serverScript = path.join(__dirname, '..', 'src', 'server.js');
    const child = spawn('node', [serverScript], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();

    // Wait a brief moment for socket binding
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[✔]')} Host server started in background.`);
  } else {
    console.log(`${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[✔]')} Host server is already active on port ${PORT}.`);
  }

  // Find suitable browser for standalone App mode
  const candidates = [
    process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env['ProgramFiles'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env['ProgramFiles'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['ProgramFiles(x86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['LocalAppData'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env['LocalAppData'] + '\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let browserPath = candidates.find(p => p && fs.existsSync(p));

  if (browserPath) {
    console.log(`${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], '[*]')} Opening standalone window via: ${path.basename(browserPath)}`);
    const browserProc = spawn(browserPath, [`--app=${DASHBOARD_URL}`], {
      detached: true,
      stdio: 'ignore'
    });
    browserProc.unref();
  } else {
    console.log(`${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], '[*]')} Opening dashboard in default browser...`);
    spawn('cmd.exe', ['/c', 'start', DASHBOARD_URL], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }

  console.log('\n' + box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ Desktop Dashboard Opened!')}`,
    ``,
    `👉 ${BOLD}${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], DASHBOARD_URL)}${RESET}`,
    `${DIM}You can close this window at any time.${RESET}`
  ], { title: 'READY', borderColor: COLORS.neonGreen }) + '\n');

  // Keep window open for 2 seconds then cleanly exit
  setTimeout(() => process.exit(0), 2500);
}

launch();
