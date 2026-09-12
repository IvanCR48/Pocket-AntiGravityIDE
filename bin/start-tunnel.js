const { spawn } = require('child_process');
const { getLogoBanner, box, Spinner, COLORS, rgb, BOLD, RESET, DIM } = require('../src/infrastructure/terminal/theme');

const PORT = process.env.PORT || 3000;

console.clear();
console.log('\n' + getLogoBanner() + '\n');
console.log(box([
  `${BOLD}🌐 Pocket Antigravity Global Access Tunnel${RESET}`,
  `${DIM}Target Local Host: http://localhost:${PORT}${RESET}`,
  `${DIM}Mode: Automatic Failover (Cloudflare -> Localtunnel)${RESET}`
], { title: 'TUNNEL INITIALIZATION', borderColor: COLORS.cyan }));

console.log('');
const spinner = new Spinner(`Provisioning secure high-speed Cloudflare tunnel for port ${PORT}...`).start();

let publicUrl = null;

function tryCloudflared() {
  const tunnelProc = spawn('cmd.exe', ['/c', 'npx', '-y', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
    windowsHide: true
  });

  tunnelProc.stdout.on('data', handleData);
  tunnelProc.stderr.on('data', handleData);

  tunnelProc.on('close', (code) => {
    if (!publicUrl) {
      spinner.update(`Cloudflare tunnel exited (${code}). Launching Localtunnel fallback...`);
      tryLocaltunnel();
    }
  });
}

function tryLocaltunnel() {
  const ltProc = spawn('cmd.exe', ['/c', 'npx', '-y', 'localtunnel', '--port', String(PORT), '--local-host', 'localhost'], {
    windowsHide: true
  });

  ltProc.stdout.on('data', handleLtData);
  ltProc.stderr.on('data', handleLtData);
}

function handleData(data) {
  const output = data.toString();
  const matches = output.match(/https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com/g);
  if (matches && matches.length > 0 && !publicUrl) {
    publicUrl = matches[0];
    spinner.succeed('Cloudflare Tunnel Provisioned Successfully!');
    printSuccess(publicUrl, 'Cloudflare Tunnel');
  }
}

function handleLtData(data) {
  const output = data.toString();
  const matches = output.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/g);
  if (matches && matches.length > 0 && !publicUrl) {
    publicUrl = matches[0];
    spinner.succeed('Localtunnel Fallback Established!');
    printSuccess(publicUrl, 'Localtunnel');
  }
}

function printSuccess(url, provider) {
  console.log('\n' + box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '🚀 ACCESS URL READY!')}`,
    ``,
    `👉 ${BOLD}${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], url)}${RESET}`,
    ``,
    `${DIM}Provider: ${provider} | Works worldwide on 4G, 5G & Wi-Fi${RESET}`,
    `${DIM}Scan the QR code below on Safari or Chrome to open the mobile PWA:${RESET}`
  ], { title: 'MOBILE CONNECTION', borderColor: COLORS.neonGreen }) + '\n');

  try {
    spawn('cmd.exe', ['/c', 'npx', '-y', 'qrcode-terminal', url, 'small'], { stdio: 'inherit' });
  } catch (_) {}
}

tryCloudflared();
