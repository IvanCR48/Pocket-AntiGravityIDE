import { checkAuthStatus, initAuth } from './auth.js';
import { initWebSocket, closeWebSocket } from './ws-client.js';
import {
  initChatView,
  loadSessions,
  loadPersonas,
  appendMessageFromStep,
  getActiveSessionId,
  setActiveSessionId
} from './views/chat-view.js';
import { initDiffView, checkChanges, updateChangesBanner } from './views/diff-view.js';
import { initFilesView, loadWorkspaceTree } from './views/files-view.js';
import { PwaManager } from './pwa.js';

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const tabChatBtn = document.getElementById('tab-chat-btn');
const tabFilesBtn = document.getElementById('tab-files-btn');
const chatContainer = document.getElementById('chat-container');
const filesContainer = document.getElementById('files-container');

// Theme Switcher Logic
function initTheme() {
  const savedTheme = localStorage.getItem('pocket_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('pocket_theme', nextTheme);
    themeToggleBtn.textContent = nextTheme === 'dark' ? '🌙' : '☀️';
  });
}

// Tab Switcher
if (tabChatBtn && tabFilesBtn && chatContainer && filesContainer) {
  tabChatBtn.addEventListener('click', () => {
    tabChatBtn.classList.add('active');
    tabFilesBtn.classList.remove('active');
    chatContainer.style.display = 'flex';
    filesContainer.style.display = 'none';
  });

  tabFilesBtn.addEventListener('click', () => {
    tabFilesBtn.classList.add('active');
    tabChatBtn.classList.remove('active');
    chatContainer.style.display = 'none';
    filesContainer.style.display = 'block';
    loadWorkspaceTree();
  });
}

function startApp() {
  initWebSocket({
    onChangesUpdated: () => {
      checkChanges();
    },
    onTranscriptStep: (data) => {
      if (getActiveSessionId() === 'NEW_PENDING_SESSION') {
        setActiveSessionId(data.conversationId);
        if (chatContainer) chatContainer.innerHTML = '';
      }
      appendMessageFromStep(data.step);
    },
    onSessionAutoSwitched: (conversationId) => {
      setActiveSessionId(conversationId);
      if (chatContainer) chatContainer.innerHTML = '';
      loadSessions();
    },
    onInit: () => {
      checkChanges();
    }
  });

  loadSessions();
  checkChanges();
  loadPersonas();
}

// Initialize Views & Handlers
initAuth({
  onAuthSuccess: () => {
    startApp();
  },
  onLock: () => {
    closeWebSocket();
  }
});

initChatView();
initDiffView();
initFilesView();

// Boot Sequence
initTheme();
const pwa = new PwaManager();
pwa.init();

checkAuthStatus().then((isAuthed) => {
  if (isAuthed) {
    startApp();
  }
});

// Demo Card 3: Ready for Swipe Review


