const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

console.log(`\n==================================================`);
console.log(`🌐 Pocket Antigravity Global Access Tunnel Launcher`);
console.log(`Starting Tunnel for http://localhost:${PORT}...`);
console.log(`==================================================\n`);

let publicUrl = null;

function tryCloudflared() {
  const tunnelProc = spawn('cmd.exe', ['/c', 'npx', '-y', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`]);

  tunnelProc.stdout.on('data', handleData);
  tunnelProc.stderr.on('data', handleData);

  tunnelProc.on('close', (code) => {
    if (!publicUrl) {
      console.log(`\n[Tunnel] cloudflared exited (code ${code}). Launching localtunnel fallback...`);
      tryLocaltunnel();
    }
  });
}

function tryLocaltunnel() {
  console.log(`[Tunnel] Starting localtunnel on port ${PORT}...`);
  const ltProc = spawn('cmd.exe', ['/c', 'npx', '-y', 'localtunnel', '--port', String(PORT), '--local-host', 'localhost']);

  ltProc.stdout.on('data', handleLtData);
  ltProc.stderr.on('data', handleLtData);
}

function handleData(data) {
  const output = data.toString();
  console.log(output);

  const matches = output.match(/https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com/g);
  if (matches && matches.length > 0 && !publicUrl) {
    publicUrl = matches[0];
    printSuccess(publicUrl);
  }
}

function handleLtData(data) {
  const output = data.toString();
  console.log(output);

  const matches = output.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/g);
  if (matches && matches.length > 0 && !publicUrl) {
    publicUrl = matches[0];
    printSuccess(publicUrl);
  }
}

function printSuccess(url) {
  console.log(`\n==================================================`);
  console.log(`🚀 SUCCESS! Your Phone Access Public URL:`);
  console.log(`👉 ${url}`);
  console.log(`==================================================`);
  console.log(`📱 Open this link on your phone (Safari / Chrome) to access Pocket Antigravity!`);
  console.log(`Works over 4G, 5G, or Wi-Fi anywhere in the world!\n`);

  try {
    spawn('cmd.exe', ['/c', 'npx', '-y', 'qrcode-terminal', url, 'small'], { stdio: 'inherit' });
  } catch (_) {}
}

tryCloudflared();
