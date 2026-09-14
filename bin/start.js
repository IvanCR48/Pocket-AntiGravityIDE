const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const readline = require('readline');
const QRCode = require('qrcode');
const { getLogoBanner, box, COLORS, rgb, BOLD, RESET, DIM } = require('../src/infrastructure/terminal/theme');
const { SystemDoctor } = require('../src/infrastructure/system/doctor');

const PORT = process.env.PORT || 3000;

function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function ensureServerRunning() {
  return isServerRunning(PORT).then((running) => {
    if (!running) {
      console.log(`${rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], '[*]')} Levantando servidor host en puerto ${PORT}...`);
      const child = spawn('cmd.exe', ['/c', 'start', 'Pocket Antigravity Server', 'node', 'src/server.js'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return new Promise((r) => setTimeout(r, 1500));
    } else {
      console.log(`${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[✔]')} Servidor host ya activo en puerto ${PORT}.`);
    }
  });
}

async function runLocalWifi() {
  await ensureServerRunning();
  const doctor = new SystemDoctor();
  const netInfo = doctor.getNetworkInfo(PORT);
  const targetUrl = netInfo.primaryUrl || `http://localhost:${PORT}`;

  console.log('\n' + box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ MODO WI-FI LOCAL ACTIVO (0ms Lag)')}`,
    ``,
    `👉 ${BOLD}${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], targetUrl)}${RESET}`,
    ``,
    `${DIM}Conectá tu celular a la misma red Wi-Fi y escaneá este QR:${RESET}`
  ], { title: 'CONEXIÓN DIRECTA LAN', borderColor: COLORS.neonGreen }) + '\n');

  try {
    const qrTerminal = await QRCode.toString(targetUrl, { type: 'terminal', small: true });
    console.log(qrTerminal);
  } catch (_) {}

  console.log(`${DIM}Para detener el servidor en cualquier momento, ejecutá bin/stop.bat${RESET}`);
  console.log(`${DIM}Presioná cualquier tecla para salir del menú launcher...${RESET}\n`);
  
  waitAndExit();
}

async function runTunnel() {
  await ensureServerRunning();
  console.log(`\n${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], '[*]')} Lanzando túnel público de acceso global...`);
  
  const tunnelProc = spawn('cmd.exe', ['/c', 'start', 'Pocket Antigravity Tunnel', 'node', 'bin/start-tunnel.js'], {
    detached: true,
    stdio: 'ignore'
  });
  tunnelProc.unref();

  console.log('\n' + box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ TÚNEL PÚBLICO INICIADO')}`,
    ``,
    `Se abrió la consola del túnel para aprovisionar Cloudflare / Localtunnel.`,
    `${DIM}Allí verás la URL con HTTPS para conectar desde 4G/5G en cualquier parte.${RESET}`
  ], { title: 'ACCESO REMOTO 4G/5G', borderColor: COLORS.cyan }) + '\n');

  waitAndExit();
}

async function runDashboard() {
  console.log(`\n${rgb(COLORS.blurple[0], COLORS.blurple[1], COLORS.blurple[2], '[*]')} Abriendo Desktop Control Center...`);
  const dashProc = spawn('node', ['bin/dashboard.js'], {
    detached: true,
    stdio: 'inherit'
  });
  dashProc.unref();
}

async function runFull() {
  await ensureServerRunning();
  console.log(`\n${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[1/2]')} Lanzando Túnel de Acceso Remoto...`);
  spawn('cmd.exe', ['/c', 'start', 'Pocket Antigravity Tunnel', 'node', 'bin/start-tunnel.js'], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  console.log(`${rgb(COLORS.blurple[0], COLORS.blurple[1], COLORS.blurple[2], '[2/2]')} Abriendo Control Center de Escritorio...`);
  spawn('node', ['bin/dashboard.js'], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  console.log('\n' + box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ TODO EL ENTORNO ESTÁ ACTIVO')}`,
    ``,
    `1. ${BOLD}Servidor Host:${RESET}      http://localhost:${PORT}`,
    `2. ${BOLD}Control Center:${RESET}     http://localhost:${PORT}/dashboard`,
    `3. ${BOLD}Túnel Remoto:${RESET}       Aprovisionando en ventana dedicada...`
  ], { title: 'MODO COMPLETO', borderColor: COLORS.neonGreen }) + '\n');

  waitAndExit();
}

function waitAndExit() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(0));
  } else {
    setTimeout(() => process.exit(0), 3000);
  }
}

// Render Menu
function showMenu() {
  console.clear();
  console.log('\n' + getLogoBanner() + '\n');

  const menuLines = [
    `¿Cómo querés conectar tu celular hoy?`,
    ``,
    `  ${BOLD}[1]${RESET} 🏠 ${BOLD}Wi-Fi Local (LAN)${RESET}  ${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[0ms Lag]')} — Para programar en casa`,
    `  ${BOLD}[2]${RESET} 🌐 ${BOLD}Túnel Público${RESET}      ${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], '[4G/5G]')} — Acceso global desde la calle`,
    `  ${BOLD}[3]${RESET} 🎛️  ${BOLD}Control Center${RESET}     ${rgb(COLORS.blurple[0], COLORS.blurple[1], COLORS.blurple[2], '[App]')} — Dashboard de escritorio estilo Discord`,
    `  ${BOLD}[4]${RESET} 🚀 ${BOLD}Modo Completo${RESET}      ${rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], '[Full]')} — Servidor + Túnel + Dashboard`,
    ``,
    `  ${BOLD}[Q]${RESET} ❌ ${DIM}Salir${RESET}`
  ];

  console.log(box(menuLines, { title: 'SELECCIÓN DE MODO DE INICIO', borderColor: COLORS.blurple }));
  console.log(`\n👉 ${BOLD}Presioná 1, 2, 3 o 4${RESET} ${DIM}(o Enter para opción por defecto [1] Wi-Fi Local):${RESET} `);

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on('keypress', (str, key) => {
      // Handle Ctrl+C
      if (key && key.ctrl && key.name === 'c') {
        process.exit();
      }

      const choice = (str || '').toLowerCase();

      if (choice === '1' || key.name === 'return') {
        process.stdin.removeAllListeners('keypress');
        process.stdin.setRawMode(false);
        runLocalWifi();
      } else if (choice === '2') {
        process.stdin.removeAllListeners('keypress');
        process.stdin.setRawMode(false);
        runTunnel();
      } else if (choice === '3') {
        process.stdin.removeAllListeners('keypress');
        process.stdin.setRawMode(false);
        runDashboard();
      } else if (choice === '4') {
        process.stdin.removeAllListeners('keypress');
        process.stdin.setRawMode(false);
        runFull();
      } else if (choice === 'q' || key.name === 'escape') {
        console.log('\nCancelado.');
        process.exit(0);
      }
    });
  } else {
    // Fallback if not interactive TTY
    runLocalWifi();
  }
}

showMenu();
