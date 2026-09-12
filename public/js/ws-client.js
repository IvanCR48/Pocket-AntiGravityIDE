import { getAuthToken, showLockscreen } from './auth.js';

let ws = null;
const statusBadge = document.getElementById('status-badge');
const chatStateBadge = document.getElementById('chat-state-badge');

let handlers = {
  onChangesUpdated: () => {},
  onTranscriptStep: () => {},
  onSessionAutoSwitched: () => {},
  onChatStateUpdate: () => {},
  onInit: () => {}
};

export function updateChatStateBadge(state) {
  if (!chatStateBadge || !state) return;
  const dot = chatStateBadge.querySelector('.status-dot');
  const text = chatStateBadge.querySelector('span:last-child');
  if (!dot || !text) return;

  if (state.isChatFocused) {
    dot.style.background = 'var(--accent-success)';
    text.textContent = 'Chat: Focused';
    chatStateBadge.style.borderColor = 'var(--accent-success)';
  } else if (state.isChatOpen) {
    dot.style.background = 'var(--accent-warning)';
    text.textContent = 'Chat: Open';
    chatStateBadge.style.borderColor = 'var(--border-color)';
  } else {
    dot.style.background = 'var(--text-muted)';
    text.textContent = 'Chat: Closed';
    chatStateBadge.style.borderColor = 'var(--border-color)';
  }
}

export function initWebSocket(callbacks = {}) {
  handlers = { ...handlers, ...callbacks };

  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getAuthToken();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const wsUrl = `${protocol}//${window.location.host}/ws${tokenParam}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (statusBadge) {
      statusBadge.innerHTML = '<span class="status-dot"></span> <span>Online</span>';
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'AUTH_REQUIRED') {
        showLockscreen();
      } else if (data.type === 'CHANGES_UPDATED') {
        handlers.onChangesUpdated(data.changes);
      } else if (data.type === 'TRANSCRIPT_STEP') {
        handlers.onTranscriptStep(data);
      } else if (data.type === 'SESSION_AUTO_SWITCHED') {
        handlers.onSessionAutoSwitched(data.conversationId);
      } else if (data.type === 'CHAT_STATE_UPDATE') {
        updateChatStateBadge(data.state);
        handlers.onChatStateUpdate(data.state);
      } else if (data.type === 'INIT') {
        if (data.chatState) updateChatStateBadge(data.chatState);
        if (data.changes) handlers.onChangesUpdated(data.changes);
        handlers.onInit(data);
      }
    } catch (e) {
      console.error('WS Message Error:', e);
    }
  };

  ws.onclose = () => {
    if (statusBadge) {
      statusBadge.innerHTML = '<span class="status-dot" style="background:var(--accent-error)"></span> <span>Offline</span>';
    }
    setTimeout(() => initWebSocket(callbacks), 3000);
  };
}

export function closeWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function sendWebSocketMessage(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
}
