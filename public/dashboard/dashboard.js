/**
 * Pocket Antigravity Host Control Center Dashboard
 * Modern desktop hub controlling diagnostics, networks, tunnels, and settings.
 */

class HostDashboard {
  constructor() {
    this.currentTab = 'doctor';
    this.networkData = null;
    this.pollTimer = null;
    this.tunnelState = { active: false, status: 'stopped', publicUrl: null };
  }

  async init() {
    this.setupTabs();
    this.setupCopyButtons();
    this.setupTunnelControls();
    this.setupSettingsForm();
    this.setupRefreshButton();
    this.setupPinToggle();
    this.setupClearLogs();

    // Initial data load
    await Promise.all([
      this.loadDiagnostics(),
      this.loadNetworkInfo(),
      this.loadTunnelStatus(),
      this.loadConfig()
    ]);

    // Start background stats polling
    this.startPolling();
    this.log('Dashboard ready. Host listening on port 3000.', 'success');
  }

  /* -----------------------------------------------------------
   * 1. Navigation & Tabs
   * ----------------------------------------------------------- */
  setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const titles = {
      doctor: { title: 'System Doctor & Dependencies', desc: 'Automated health inspection of your local development environment' },
      network: { title: 'Network & Access Hub', desc: 'Connect your phone over Local Wi-Fi (0ms lag) or Global Cloudflare Tunnel' },
      settings: { title: 'Host Settings & Security', desc: 'Configure security PIN, server port, and Windows power management' },
      status: { title: 'Live Host Monitor', desc: 'Real-time telemetry, connected mobile clients, and system resources' }
    };

    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        this.currentTab = tab;

        navItems.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(`tab-${tab}`);
        if (targetPane) targetPane.classList.add('active');

        const pageTitle = document.getElementById('page-title');
        const pageDesc = document.getElementById('page-desc');
        if (titles[tab]) {
          pageTitle.textContent = titles[tab].title;
          pageDesc.textContent = titles[tab].desc;
        }
      });
    });

    // Connection mode sub-tabs (Wi-Fi vs Tunnel)
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        modeTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const target = document.getElementById(`mode-${mode}-content`);
        if (target) target.classList.add('active');
      });
    });
  }

  /* -----------------------------------------------------------
   * 2. System Doctor Diagnostics
   * ----------------------------------------------------------- */
  async loadDiagnostics() {
    try {
      const res = await fetch('/api/system/doctor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.renderDiagnostics(data);
    } catch (err) {
      this.log(`Failed to run diagnostics: ${err.message}`, 'error');
    }
  }

  renderDiagnostics(data) {
    let passedCount = 0;
    const totalChecks = 4;

    // 1. Node.js
    const nodeBadge = document.getElementById('node-badge');
    const nodeVer = document.getElementById('node-version');
    nodeVer.textContent = data.node.version || 'Unknown';
    if (data.node.status === 'ok') {
      nodeBadge.className = 'status-badge badge-ok';
      nodeBadge.textContent = 'Installed';
      passedCount++;
    } else {
      nodeBadge.className = 'status-badge badge-warning';
      nodeBadge.textContent = 'Upgrade Recommended';
    }

    // 2. Git
    const gitBadge = document.getElementById('git-badge');
    const gitVer = document.getElementById('git-version');
    const gitStatusText = document.getElementById('git-status-text');
    if (data.git.status === 'ok') {
      gitVer.textContent = data.git.version;
      gitBadge.className = 'status-badge badge-ok';
      gitBadge.textContent = 'Ready';
      gitStatusText.textContent = 'Git CLI detected & functional';
      passedCount++;
    } else {
      gitVer.textContent = 'Not Found';
      gitBadge.className = 'status-badge badge-error';
      gitBadge.textContent = 'Missing';
      gitStatusText.textContent = 'Install Git for Windows';
    }

    // 3. PowerShell
    const psBadge = document.getElementById('ps-badge');
    const psVer = document.getElementById('ps-version');
    const psStatusText = document.getElementById('ps-status-text');
    if (data.powershell.status === 'ok') {
      psVer.textContent = `Version ${data.powershell.version}`;
      psBadge.className = 'status-badge badge-ok';
      psBadge.textContent = 'Active';
      psStatusText.textContent = 'Automation bridge ready';
      passedCount++;
    } else {
      psVer.textContent = 'Not Found';
      psBadge.className = 'status-badge badge-error';
      psBadge.textContent = 'Missing';
    }

    // 4. Antigravity IDE
    const ideBadge = document.getElementById('ide-badge');
    const ideStatusLabel = document.getElementById('ide-status-label');
    const ideStatusText = document.getElementById('ide-status-text');
    if (data.antigravity.status === 'running') {
      ideStatusLabel.textContent = 'Process Active';
      ideBadge.className = 'status-badge badge-ok';
      ideBadge.textContent = 'Running';
      ideStatusText.textContent = 'Ready to receive prompts from phone';
      passedCount++;
    } else {
      ideStatusLabel.textContent = 'Not Detected';
      ideBadge.className = 'status-badge badge-warning';
      ideBadge.textContent = 'Idle';
      ideStatusText.textContent = 'Open Antigravity IDE on this PC';
    }

    // Summary Score
    const doctorBadge = document.getElementById('doctor-badge');
    const healthScore = document.getElementById('health-score');
    const healthRec = document.getElementById('health-recommendation');

    if (passedCount === totalChecks) {
      doctorBadge.textContent = '100% Ready';
      doctorBadge.style.color = '#57f287';
      healthScore.textContent = '100% — Optimal';
      healthScore.style.color = '#57f287';
      healthRec.textContent = 'All development dependencies and the Antigravity IDE process are active. Scan the QR code with your phone to start coding!';
    } else {
      doctorBadge.textContent = `${passedCount}/${totalChecks} Checks`;
      doctorBadge.style.color = '#fee75c';
      healthScore.textContent = `${Math.round((passedCount / totalChecks) * 100)}%`;
      healthScore.style.color = '#fee75c';
      healthRec.textContent = 'Some components require attention. Verify that Antigravity IDE is open.';
    }
  }

  /* -----------------------------------------------------------
   * 3. Network & Reachable IP Endpoints
   * ----------------------------------------------------------- */
  async loadNetworkInfo() {
    try {
      const res = await fetch('/api/system/network');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.networkData = data;
      this.renderNetworkInfo(data);
    } catch (err) {
      this.log(`Network resolution failed: ${err.message}`, 'error');
    }
  }

  renderNetworkInfo(data) {
    const lanInput = document.getElementById('lan-url-input');
    const lanQrImg = document.getElementById('lan-qr-img');
    const container = document.getElementById('network-cards-container');

    const primaryUrl = data.primaryUrl || `http://localhost:${data.port}`;
    lanInput.value = primaryUrl;

    // Render SVG QR code via backend
    lanQrImg.src = `/api/system/qr?text=${encodeURIComponent(primaryUrl)}`;

    // Render list of network cards
    container.innerHTML = '';
    const allInterfaces = [...(data.lanUrls || []), ...(data.virtualUrls || [])];
    allInterfaces.forEach(entry => {
      const pill = document.createElement('span');
      pill.className = 'interface-pill';
      pill.textContent = `${entry.interface}: ${entry.ip}`;
      pill.title = `Click to set as primary URL`;
      pill.style.cursor = 'pointer';
      pill.addEventListener('click', () => {
        lanInput.value = entry.url;
        lanQrImg.src = `/api/system/qr?text=${encodeURIComponent(entry.url)}`;
        this.log(`Selected network interface ${entry.interface} (${entry.ip})`, 'info');
      });
      container.appendChild(pill);
    });

    document.getElementById('footer-server-status').textContent = `Host: Port ${data.port}`;
  }

  /* -----------------------------------------------------------
   * 4. Public Cloudflare Tunnel Controls
   * ----------------------------------------------------------- */
  async loadTunnelStatus() {
    try {
      const res = await fetch('/api/system/tunnel');
      if (!res.ok) return;
      const status = await res.json();
      this.tunnelState = status;
      this.renderTunnelStatus(status);
    } catch (_) {}
  }

  renderTunnelStatus(status) {
    const badge = document.getElementById('tunnel-status-badge');
    const btn = document.getElementById('toggle-tunnel-btn');
    const btnText = document.getElementById('tunnel-btn-text');
    const btnIcon = document.getElementById('tunnel-btn-icon');
    const statusText = document.getElementById('tunnel-status-text');
    const endpointBox = document.getElementById('tunnel-endpoint-box');
    const urlInput = document.getElementById('tunnel-url-input');
    const qrBox = document.getElementById('tunnel-qr-box');
    const qrImg = document.getElementById('tunnel-qr-img');
    const chip = document.getElementById('tunnel-chip');

    if (status.active && status.publicUrl) {
      badge.className = 'badge badge-active';
      badge.textContent = 'Tunnel Active (Global Access)';
      btn.className = 'btn btn-secondary btn-tunnel-action';
      btnText.textContent = 'Stop Tunnel';
      btnIcon.textContent = '🛑';
      statusText.textContent = `Provider: ${status.provider || 'Cloudflare'}`;
      endpointBox.style.display = 'block';
      qrBox.style.display = 'flex';
      urlInput.value = status.publicUrl;
      qrImg.src = `/api/system/qr?text=${encodeURIComponent(status.publicUrl)}`;
      chip.textContent = 'Online';
      chip.className = 'pill-chip chip-fast';
    } else if (status.status === 'starting') {
      badge.className = 'badge badge-tunnel';
      badge.textContent = 'Connecting...';
      btnText.textContent = 'Connecting...';
      btnIcon.textContent = '⏳';
      statusText.textContent = 'Provisioning secure public tunnel...';
      endpointBox.style.display = 'none';
      qrBox.style.display = 'none';
    } else {
      badge.className = 'badge badge-tunnel';
      badge.textContent = 'Tunnel Stopped';
      btn.className = 'btn btn-primary btn-tunnel-action';
      btnText.textContent = 'Start Cloudflare Tunnel';
      btnIcon.textContent = '⚡';
      statusText.textContent = 'Idle (No active tunnel)';
      endpointBox.style.display = 'none';
      qrBox.style.display = 'none';
      chip.textContent = 'Offline';
      chip.className = 'pill-chip chip-cloud';
    }
  }

  setupTunnelControls() {
    const btn = document.getElementById('toggle-tunnel-btn');
    btn.addEventListener('click', async () => {
      const isRunning = this.tunnelState && this.tunnelState.active;
      const endpoint = isRunning ? '/api/system/tunnel/stop' : '/api/system/tunnel/start';

      btn.disabled = true;
      document.getElementById('tunnel-btn-text').textContent = isRunning ? 'Stopping...' : 'Launching...';

      try {
        const res = await fetch(endpoint, { method: 'POST' });
        const data = await res.json();
        this.tunnelState = data;
        this.renderTunnelStatus(data);
        this.log(isRunning ? 'Public tunnel stopped.' : `Tunnel launched: ${data.publicUrl || 'Starting'}`, 'info');
      } catch (err) {
        this.log(`Tunnel action failed: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* -----------------------------------------------------------
   * 5. Settings & Power Management
   * ----------------------------------------------------------- */
  async loadConfig() {
    try {
      const res = await fetch('/api/system/config');
      if (!res.ok) return;
      const cfg = await res.json();

      if (cfg.pin !== undefined) document.getElementById('cfg-pin').value = cfg.pin;
      if (cfg.port !== undefined) document.getElementById('cfg-port').value = cfg.port;
      if (cfg.preventSleep !== undefined) document.getElementById('cfg-prevent-sleep').checked = Boolean(cfg.preventSleep);
      if (cfg.defaultPersona) document.getElementById('cfg-persona').value = cfg.defaultPersona;
    } catch (err) {
      this.log(`Could not load configuration: ${err.message}`, 'warn');
    }
  }

  setupSettingsForm() {
    const form = document.getElementById('config-form');
    const feedback = document.getElementById('config-save-feedback');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        pin: document.getElementById('cfg-pin').value,
        port: parseInt(document.getElementById('cfg-port').value, 10),
        preventSleep: document.getElementById('cfg-prevent-sleep').checked,
        defaultPersona: document.getElementById('cfg-persona').value
      };

      try {
        const res = await fetch('/api/system/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          feedback.textContent = '✓ Settings saved successfully!';
          feedback.style.color = '#57f287';
          this.log('Host configuration updated and persisted to pocket.config.json', 'success');
          setTimeout(() => { feedback.textContent = ''; }, 3500);
        } else {
          feedback.textContent = 'Failed to save settings.';
          feedback.style.color = '#ed4245';
        }
      } catch (err) {
        feedback.textContent = err.message;
        feedback.style.color = '#ed4245';
      }
    });
  }

  setupPinToggle() {
    const toggleBtn = document.getElementById('toggle-pin-visibility');
    const pinInput = document.getElementById('cfg-pin');
    toggleBtn.addEventListener('click', () => {
      if (pinInput.type === 'password') {
        pinInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        pinInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });
  }

  /* -----------------------------------------------------------
   * 6. Live Monitor & Polling
   * ----------------------------------------------------------- */
  startPolling() {
    this.pollStats();
    this.pollTimer = setInterval(() => this.pollStats(), 3000);
  }

  async pollStats() {
    try {
      const res = await fetch('/api/system/stats');
      if (!res.ok) return;
      const stats = await res.json();

      document.getElementById('stat-clients').textContent = stats.clientCount || 0;
      document.getElementById('stat-memory').textContent = `${stats.memoryUsageMb || 0} MB`;

      const minutes = Math.floor((stats.uptimeSeconds || 0) / 60);
      const hours = Math.floor(minutes / 60);
      document.getElementById('stat-uptime').textContent = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;

      const sessionElem = document.getElementById('stat-session');
      if (stats.activeConversationId) {
        sessionElem.textContent = stats.activeConversationId.slice(0, 8) + '...';
        sessionElem.title = stats.activeConversationId;
      } else {
        sessionElem.textContent = 'None';
      }

      // Also check tunnel status in background
      await this.loadTunnelStatus();
    } catch (_) {}
  }

  /* -----------------------------------------------------------
   * 7. Utilities & Clipboard
   * ----------------------------------------------------------- */
  setupCopyButtons() {
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input || !input.value) return;

        try {
          await navigator.clipboard.writeText(input.value);
          const origText = btn.querySelector('span').textContent;
          btn.querySelector('span').textContent = 'Copied!';
          btn.classList.add('btn-copy-success');
          setTimeout(() => {
            btn.querySelector('span').textContent = origText;
            btn.classList.remove('btn-copy-success');
          }, 2000);
        } catch (_) {
          input.select();
          document.execCommand('copy');
        }
      });
    });
  }

  setupRefreshButton() {
    const btn = document.getElementById('refresh-all-btn');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await Promise.all([
        this.loadDiagnostics(),
        this.loadNetworkInfo(),
        this.loadTunnelStatus(),
        this.loadConfig()
      ]);
      this.log('Diagnostics and network configuration refreshed.', 'info');
      btn.disabled = false;
    });
  }

  setupClearLogs() {
    const btn = document.getElementById('clear-log-btn');
    btn.addEventListener('click', () => {
      const terminal = document.getElementById('activity-log');
      terminal.innerHTML = '';
      this.log('Log cleared.', 'info');
    });
  }

  log(message, type = 'info') {
    const terminal = document.getElementById('activity-log');
    if (!terminal) return;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> ${message}`;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
  }
}

// Boot Dashboard on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new HostDashboard();
  window.dashboard.init();
});
