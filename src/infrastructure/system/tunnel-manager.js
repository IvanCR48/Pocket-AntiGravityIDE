const { spawn, exec } = require('child_process');

/**
 * TunnelManager controls public remote access tunnels (Cloudflare / Localtunnel)
 * on demand without needing external terminal windows.
 */
class TunnelManager {
  constructor() {
    this._process = null;
    this._status = 'stopped'; // 'stopped' | 'starting' | 'active' | 'error'
    this._publicUrl = null;
    this._provider = null; // 'cloudflare' | 'localtunnel'
    this._error = null;
    this._listeners = new Set();
  }

  getStatus() {
    return {
      active: this._status === 'active',
      status: this._status,
      publicUrl: this._publicUrl,
      provider: this._provider,
      error: this._error
    };
  }

  onStatusChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notify() {
    const status = this.getStatus();
    for (const listener of this._listeners) {
      try {
        listener(status);
      } catch (_) {}
    }
  }

  /**
   * Start a public tunnel to expose local port
   * @param {number} port
   */
  start(port = 3000) {
    if (this._status === 'active' || this._status === 'starting') {
      return Promise.resolve(this.getStatus());
    }

    this._status = 'starting';
    this._publicUrl = null;
    this._provider = 'cloudflare';
    this._error = null;
    this._notify();

    return new Promise((resolve) => {
      let resolved = false;

      // 1. Try Cloudflare Tunnel first
      const cfProc = spawn('cmd.exe', [
        '/c', 'npx', '-y', 'cloudflared', 'tunnel', '--url', `http://localhost:${port}`
      ], { windowsHide: true });

      this._process = cfProc;

      const handleOutput = (data) => {
        const text = data.toString();
        const matches = text.match(/https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com/g);
        if (matches && matches.length > 0 && !this._publicUrl) {
          this._publicUrl = matches[0];
          this._status = 'active';
          this._provider = 'cloudflare';
          this._notify();
          if (!resolved) {
            resolved = true;
            resolve(this.getStatus());
          }
        }
      };

      cfProc.stdout.on('data', handleOutput);
      cfProc.stderr.on('data', handleOutput);

      cfProc.on('error', (err) => {
        console.error('[TunnelManager] Cloudflare error:', err.message);
      });

      cfProc.on('close', (code) => {
        if (!this._publicUrl && this._status === 'starting') {
          console.log(`[TunnelManager] Cloudflare exited (code ${code}). Attempting localtunnel fallback...`);
          this._startLocaltunnelFallback(port, resolve);
        } else if (this._status === 'active') {
          this._status = 'stopped';
          this._publicUrl = null;
          this._notify();
        }
      });

      // Timeout safety: if after 30s no URL, fallback
      setTimeout(() => {
        if (this._status === 'starting' && !resolved) {
          this._startLocaltunnelFallback(port, resolve);
        }
      }, 30000);
    });
  }

  _startLocaltunnelFallback(port, resolve) {
    this._provider = 'localtunnel';
    const ltProc = spawn('cmd.exe', [
      '/c', 'npx', '-y', 'localtunnel', '--port', String(port), '--local-host', 'localhost'
    ], { windowsHide: true });

    this._process = ltProc;

    const handleLtOutput = (data) => {
      const text = data.toString();
      const matches = text.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/g);
      if (matches && matches.length > 0 && !this._publicUrl) {
        this._publicUrl = matches[0];
        this._status = 'active';
        this._notify();
        resolve(this.getStatus());
      }
    };

    ltProc.stdout.on('data', handleLtOutput);
    ltProc.stderr.on('data', handleLtOutput);

    ltProc.on('close', () => {
      this._status = 'stopped';
      this._publicUrl = null;
      this._notify();
    });
  }

  /**
   * Stop any running tunnel process
   */
  stop() {
    if (this._process) {
      const pid = this._process.pid;
      if (process.platform === 'win32' && pid) {
        // Kill the whole process tree spawned by cmd.exe
        exec(`taskkill /pid ${pid} /T /F`, () => {});
      } else {
        try {
          this._process.kill('SIGTERM');
        } catch (_) {}
      }
      this._process = null;
    }

    this._status = 'stopped';
    this._publicUrl = null;
    this._provider = null;
    this._error = null;
    this._notify();
    return this.getStatus();
  }
}

module.exports = { TunnelManager };
