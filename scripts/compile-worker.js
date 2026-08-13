const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const srcFile = path.join(__dirname, '..', 'src', 'injector', 'ChatStateWorker.cs');
const outFile = path.join(__dirname, '..', 'src', 'injector', 'chat-state-worker.exe');

console.log('[Compiler] Locating C# compiler (csc.exe)...');

const cscPaths = [
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
  'csc.exe'
];

let cscExe = null;
for (const p of cscPaths) {
  try {
    execSync(`"${p}" /?`, { stdio: 'ignore' });
    cscExe = p;
    break;
  } catch (err) {
    // continue
  }
}

if (!cscExe) {
  console.error('[Compiler] Error: csc.exe not found on system.');
  process.exit(1);
}

// Locate UIAutomation DLLs in GAC or Reference Assemblies
let clientDll = 'UIAutomationClient.dll';
let typesDll = 'UIAutomationTypes.dll';

try {
  const getLoc = (asm) => execSync(`powershell -NoProfile -Command "[System.Reflection.Assembly]::LoadWithPartialName('${asm}').Location"`, { encoding: 'utf8' }).trim();
  const locClient = getLoc('UIAutomationClient');
  const locTypes = getLoc('UIAutomationTypes');
  if (locClient && fs.existsSync(locClient)) clientDll = locClient;
  if (locTypes && fs.existsSync(locTypes)) typesDll = locTypes;
} catch (err) {
  console.warn('[Compiler] Warning: could not resolve GAC assemblies via PowerShell, using default names.');
}

console.log(`[Compiler] Compiling using: ${cscExe}`);
console.log(`[Compiler] UIAutomationClient: ${clientDll}`);
console.log(`[Compiler] UIAutomationTypes: ${typesDll}`);

const cmd = `"${cscExe}" /nologo /out:"${outFile}" /r:"${clientDll}" /r:"${typesDll}" "${srcFile}"`;

try {
  const output = execSync(cmd, { encoding: 'utf8' });
  if (output) console.log(output);
  console.log(`[Compiler] Success! Executable created at: ${outFile}`);
} catch (err) {
  console.error('[Compiler] Compilation failed:', err.stdout || err.stderr || err.message);
  process.exit(1);
}
