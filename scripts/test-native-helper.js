const { execFile } = require('child_process');
const path = require('path');

const exePath = path.join(__dirname, '..', 'bin', 'antigravity-helper.exe');

console.time('native-helper-state');
execFile(exePath, ['state'], (err, stdout, stderr) => {
  console.timeEnd('native-helper-state');
  if (err) {
    console.error('Exec error:', err);
    return;
  }
  console.log('STDOUT:', stdout.trim());
});
