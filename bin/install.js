const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getLogoBanner, box, COLORS, rgb, BOLD, RESET, DIM } = require('../src/infrastructure/terminal/theme');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');

console.clear();
console.log('\n' + getLogoBanner() + '\n');

if (!fs.existsSync(PKG_PATH)) {
  console.error(rgb(COLORS.red[0], COLORS.red[1], COLORS.red[2], '[ERROR] package.json no encontrado en: ' + ROOT_DIR));
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const dependencies = pkg.dependencies || {};
const depNames = Object.keys(dependencies);

console.log(box([
  `${BOLD}📦 Pocket Antigravity - Gestor de Dependencias Inteligente${RESET}`,
  `${DIM}Verificando módulos instalados en node_modules...${RESET}`
], { title: 'DEPENDENCY VERIFICATION', borderColor: COLORS.blurple }));
console.log('');

const missing = [];
const installed = [];

for (const dep of depNames) {
  try {
    const resolvedPath = require.resolve(dep, { paths: [ROOT_DIR] });
    let version = 'detectada';
    try {
      // Intenta obtener la versión real instalada en node_modules
      const depPkgPath = path.join(path.dirname(resolvedPath), 'package.json');
      if (fs.existsSync(depPkgPath)) {
        const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
        version = depPkg.version ? `v${depPkg.version}` : version;
      }
    } catch (_) {}

    installed.push({ name: dep, version });
    console.log(`  ${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[✔]')} ${BOLD}${dep}${RESET} ${DIM}(${version})${RESET}`);
  } catch (_) {
    missing.push(dep);
    console.log(`  ${rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], '[✗]')} ${BOLD}${dep}${RESET} ${rgb(COLORS.red[0], COLORS.red[1], COLORS.red[2], '(NO INSTALADA)')}`);
  }
}

console.log('');

if (missing.length === 0) {
  console.log(box([
    `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ TODAS LAS DEPENDENCIAS ESTÁN INSTALADAS')}`,
    ``,
    `No hace falta descargar nada de internet.`,
    `${DIM}Tu entorno está 100% optimizado y listo para correr.${RESET}`
  ], { title: 'SISTEMA AL DÍA', borderColor: COLORS.neonGreen }));

  console.log(`\n${DIM}Podés iniciar Pocket Antigravity con: bin/start.bat${RESET}\n`);
  process.exit(0);
} else {
  console.log(box([
    `${rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], `! SE DETECTARON ${missing.length} DEPENDENCIA(S) FALTANTE(S)`)}`,
    ``,
    `Instalando únicamente: ${BOLD}${missing.join(', ')}${RESET}`,
    `${DIM}No se reinstalarán los paquetes que ya existen.${RESET}`
  ], { title: 'INSTALANDO DEPENDENCIAS', borderColor: COLORS.yellow }));

  console.log(`\n${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], '[*]')} Ejecutando npm install ${missing.join(' ')}...\n`);

  // Instala única y exclusivamente los paquetes faltantes
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installProc = spawn(npmCmd, ['install', ...missing], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  installProc.on('close', (code) => {
    console.log('');
    if (code === 0) {
      console.log(box([
        `${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔ INSTALACIÓN COMPLETADA CON ÉXITO')}`,
        ``,
        `Se instalaron los paquetes faltantes sin tocar el resto.`,
        `${DIM}Ya podés ejecutar bin/start.bat para iniciar el sistema.${RESET}`
      ], { title: 'LISTO PARA USAR', borderColor: COLORS.neonGreen }));
    } else {
      console.log(box([
        `${rgb(COLORS.red[0], COLORS.red[1], COLORS.red[2], '✖ ERROR EN LA INSTALACIÓN')}`,
        `npm finalizó con código de error ${code}.`,
        `Verificá tu conexión a internet o los permisos de la carpeta.`
      ], { title: 'FALLÓ INSTALACIÓN', borderColor: COLORS.red }));
    }
    console.log('');
  });
}
