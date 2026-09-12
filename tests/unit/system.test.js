const test = require('node:test');
const assert = require('node:assert');
const { SystemDoctor } = require('../../src/infrastructure/system/doctor');
const { loadConfig, saveConfig } = require('../../src/infrastructure/security/pin-auth');

test('SystemDoctor Diagnostics Suite', async (t) => {
  const doctor = new SystemDoctor();

  await t.test('returns diagnostics with valid node, git, and powershell checks', async () => {
    const diag = await doctor.getDiagnostics();
    assert.ok(diag.timestamp);
    assert.ok(diag.platform);
    assert.ok(diag.arch);
    assert.strictEqual(typeof diag.node.status, 'string');
    assert.strictEqual(typeof diag.git.status, 'string');
    assert.strictEqual(typeof diag.powershell.status, 'string');
    assert.strictEqual(typeof diag.antigravity.status, 'string');
    assert.strictEqual(typeof diag.keepAwake.active, 'boolean');
  });

  await t.test('resolves local network endpoints and identifies IPv4 interfaces', () => {
    const netInfo = doctor.getNetworkInfo(8080);
    assert.strictEqual(netInfo.port, 8080);
    assert.ok(netInfo.hostname);
    assert.ok(Array.isArray(netInfo.lanUrls));
    assert.ok(Array.isArray(netInfo.virtualUrls));
    assert.ok(netInfo.primaryUrl.startsWith('http://'));
    assert.ok(netInfo.primaryUrl.includes('8080'));
  });

  await t.test('toggles keep-awake state safely', () => {
    const initial = doctor.isKeepAwakeActive();
    doctor.setKeepAwake(false);
    assert.strictEqual(doctor.isKeepAwakeActive(), false);
  });
});

test('Configuration Persistence', async (t) => {
  await t.test('loads default or stored configuration safely', () => {
    const config = loadConfig();
    assert.ok(config);
    assert.ok(config.pin);
    assert.strictEqual(typeof config.port, 'number');
  });

  await t.test('updates and preserves configuration keys with saveConfig', () => {
    const original = loadConfig();
    const updated = saveConfig({ preventSleep: true });
    assert.strictEqual(updated.preventSleep, true);

    // Restore original
    saveConfig({ preventSleep: original.preventSleep || false });
  });
});
