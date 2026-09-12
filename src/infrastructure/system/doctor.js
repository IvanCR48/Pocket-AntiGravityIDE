const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * System Doctor & Diagnostics Service
 * Inspects system runtime dependencies, networks, and power states.
 */
class SystemDoctor {
  constructor() {
    this._keepAwakeProcess = null;
    this._isKeepAwakeEnabled = false;
  }

  /**
   * Run full diagnostics suite on local machine
   */
  async getDiagnostics() {
    const [gitResult, psResult, ideResult] = await Promise.all([
      this._checkGit(),
      this._checkPowerShell(),
      this._checkAntigravityIde()
    ]);

    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    return {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      node: {
        status: nodeMajor >= 18 ? 'ok' : 'warning',
        version: nodeVersion,
        recommended: '>= 18.0.0'
      },
      git: gitResult,
      powershell: psResult,
      antigravity: ideResult,
      keepAwake: {
        active: this._isKeepAwakeEnabled
      }
    };
  }

  /**
   * Get all active IPv4 network interfaces categorized by type
   * @param {number} port Active HTTP server port
   */
  getNetworkInfo(port = 3000) {
    const interfaces = os.networkInterfaces();
    const result = {
      hostname: os.hostname(),
      port,
      primaryUrl: `http://localhost:${port}`,
      lanUrls: [],
      virtualUrls: []
    };

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        // Only keep external IPv4
        if (addr.family === 'IPv4' && !addr.internal) {
          const lowerName = name.toLowerCase();
          const isVirtual = lowerName.includes('tailscale') ||
                            lowerName.includes('zerotier') ||
                            lowerName.includes('vethernet') ||
                            lowerName.includes('wsl');

          const entry = {
            interface: name,
            ip: addr.address,
            url: `http://${addr.address}:${port}`,
            type: isVirtual ? 'virtual' : 'lan'
          };

          if (isVirtual) {
            result.virtualUrls.push(entry);
          } else {
            result.lanUrls.push(entry);
          }
        }
      }
    }

    // Determine primary reachable IP (prefer LAN, fallback to first available or localhost)
    if (result.lanUrls.length > 0) {
      result.primaryUrl = result.lanUrls[0].url;
      result.primaryIp = result.lanUrls[0].ip;
    } else if (result.virtualUrls.length > 0) {
      result.primaryUrl = result.virtualUrls[0].url;
      result.primaryIp = result.virtualUrls[0].ip;
    } else {
      result.primaryIp = '127.0.0.1';
    }

    return result;
  }

  /**
   * Toggle Windows Keep-Awake state (prevents PC from sleeping during coding sessions)
   */
  setKeepAwake(enable) {
    if (process.platform !== 'win32') {
      this._isKeepAwakeEnabled = Boolean(enable);
      return this._isKeepAwakeEnabled;
    }

    if (enable && !this._keepAwakeProcess) {
      // Spawn lightweight PowerShell process with ES_CONTINUOUS | ES_SYSTEM_REQUIRED
      const psScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class NativePower {
            [DllImport("kernel32.dll", SetLastError = true)]
            public static extern uint SetThreadExecutionState(uint esFlags);
        }
"@
        # 0x80000001 = ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        [NativePower]::SetThreadExecutionState(0x80000001)
        while($true) { Start-Sleep -Seconds 60 }
      `;

      this._keepAwakeProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript
      ], { windowsHide: true });

      this._keepAwakeProcess.on('exit', () => {
        this._keepAwakeProcess = null;
        this._isKeepAwakeEnabled = false;
      });

      this._isKeepAwakeEnabled = true;
    } else if (!enable && this._keepAwakeProcess) {
      try {
        this._keepAwakeProcess.kill();
      } catch (_) {}
      this._keepAwakeProcess = null;
      this._isKeepAwakeEnabled = false;
    }

    return this._isKeepAwakeEnabled;
  }

  isKeepAwakeActive() {
    return this._isKeepAwakeEnabled;
  }

  async _checkGit() {
    try {
      const { stdout } = await execAsync('git --version', { timeout: 3000 });
      return {
        status: 'ok',
        version: stdout.trim()
      };
    } catch (_) {
      return {
        status: 'missing',
        message: 'Git CLI not found in PATH'
      };
    }
  }

  async _checkPowerShell() {
    try {
      const { stdout } = await execAsync('powershell.exe -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"', { timeout: 4000 });
      return {
        status: 'ok',
        version: stdout.trim()
      };
    } catch (_) {
      return {
        status: 'missing',
        message: 'PowerShell not detected'
      };
    }
  }

  async _checkAntigravityIde() {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('tasklist', { timeout: 4000 });
        const isRunning = stdout.toLowerCase().includes('antigravity');
        return {
          status: isRunning ? 'running' : 'not_detected',
          details: isRunning ? 'Antigravity IDE process active' : 'Antigravity IDE process not found in tasklist'
        };
      }
      return {
        status: 'unknown',
        details: 'Platform is not Windows'
      };
    } catch (err) {
      return {
        status: 'error',
        details: err.message
      };
    }
  }
}

module.exports = { SystemDoctor };
