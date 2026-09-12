/**
 * Progressive Web App (PWA) Manager
 * Handles Service Worker lifecycle, install prompt triggers, and standalone mode detection.
 */

export class PwaManager {
  constructor() {
    this.deferredPrompt = null;
    this.installBtn = document.getElementById('pwa-install-btn');
  }

  init() {
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.detectStandaloneMode();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent browser's mini-infobar on mobile Chrome
      e.preventDefault();
      this.deferredPrompt = e;

      if (this.installBtn) {
        this.installBtn.style.display = 'inline-flex';
        this.installBtn.addEventListener('click', () => this.promptInstall());
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      if (this.installBtn) {
        this.installBtn.style.display = 'none';
      }
      console.log('[PWA] Pocket Antigravity installed as standalone app!');
    });
  }

  async promptInstall() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('[PWA] User response to install prompt:', outcome);

    this.deferredPrompt = null;
    if (this.installBtn) {
      this.installBtn.style.display = 'none';
    }
  }

  detectStandaloneMode() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone ||
                         document.referrer.includes('android-app://');

    if (isStandalone) {
      document.body.classList.add('pwa-standalone');
      console.log('[PWA] Running in standalone native display mode');
    }
  }
}
