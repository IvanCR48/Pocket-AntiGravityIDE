import { authFetch } from '../auth.js';

let activeSessionId = null;
let selectedFile = null;
let selectedPersonaId = localStorage.getItem('pocket_persona_id') || 'pair';
let availablePersonas = [];

const chatContainer = document.getElementById('chat-container');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const sessionSelect = document.getElementById('session-select');
const newChatBtn = document.getElementById('new-chat-btn');
const previewArea = document.getElementById('attachment-preview');
const previewName = document.getElementById('preview-name');
const personaChipsBar = document.getElementById('persona-chips-bar');
const personaBadge = document.getElementById('persona-badge');

// Configure Marked.js options
if (typeof marked !== 'undefined') {
  marked.setOptions({
    gfm: true,
    breaks: true
  });
}

// Global Copy Helper
window.copyCodeSnippet = function (btn) {
  const wrapper = btn.closest('.code-block-wrapper');
  if (!wrapper) return;
  const codeText = wrapper.querySelector('code').innerText;
  navigator.clipboard.writeText(codeText).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.color = '#4ec9b0';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = '';
    }, 2000);
  });
};

export function parseMarkdown(text) {
  if (!text) return '';

  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    let html = marked.parse(text);

    html = html.replace(/<pre><code class="(?:language-)?([^"]+)">([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            <span class="code-lang">${lang}</span>
            <button class="copy-btn" onclick="copyCodeSnippet(this)">Copy</button>
          </div>
          <pre><code class="language-${lang}">${code}</code></pre>
        </div>
      `;
    });

    html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            <span class="code-lang">code</span>
            <button class="copy-btn" onclick="copyCodeSnippet(this)">Copy</button>
          </div>
          <pre><code>${code}</code></pre>
        </div>
      `;
    });

    return html;
  }

  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const l = lang || 'code';
    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span class="code-lang">${l}</span>
          <button class="copy-btn" onclick="copyCodeSnippet(this)">Copy</button>
        </div>
        <pre><code class="language-${l}">${code.trim()}</code></pre>
      </div>
    `;
  });

  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\n/g, '<br/>');

  return escaped;
}

export function scrollToBottom() {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

export function renderMessage(role, text) {
  if (!text || !chatContainer) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = role === 'user' ? 'You' : 'Antigravity Assistant';

  const body = document.createElement('div');
  body.className = 'message-body';
  body.innerHTML = parseMarkdown(text);

  msgDiv.appendChild(meta);
  msgDiv.appendChild(body);
  chatContainer.appendChild(msgDiv);
  scrollToBottom();
}

export function appendMessageFromStep(step) {
  let role = 'assistant';
  if (step.type === 'USER_INPUT' || step.source === 'USER_EXPLICIT') {
    role = 'user';
  }
  let text = typeof step.content === 'string' ? step.content : JSON.stringify(step.content);
  if (text) {
    renderMessage(role, text);
  }
}

export function getActiveSessionId() {
  return activeSessionId;
}

export function setActiveSessionId(id) {
  activeSessionId = id;
}

// Assistant Persona Management
export async function loadPersonas() {
  if (!personaChipsBar) return;
  try {
    const res = await authFetch('/api/personas');
    const data = await res.json();
    if (data.personas && Array.isArray(data.personas)) {
      availablePersonas = data.personas;
      renderPersonaChips();
    }
  } catch (err) {
    console.warn('[Personas] Failed to load personas:', err.message);
  }
}

export function renderPersonaChips() {
  if (!personaChipsBar) return;
  personaChipsBar.innerHTML = '';

  availablePersonas.forEach((p) => {
    const chip = document.createElement('button');
    chip.className = `persona-chip ${p.id === selectedPersonaId ? 'active' : ''}`;
    chip.setAttribute('type', 'button');
    chip.setAttribute('title', p.description || p.name);
    chip.innerHTML = `<span>${p.icon || '🤖'}</span> <span>${p.name}</span>`;

    chip.addEventListener('click', () => {
      selectPersona(p.id);
    });

    personaChipsBar.appendChild(chip);
  });

  updatePersonaBadge();
}

export function selectPersona(id) {
  selectedPersonaId = id;
  localStorage.setItem('pocket_persona_id', id);

  if (personaChipsBar) {
    const chips = personaChipsBar.querySelectorAll('.persona-chip');
    chips.forEach((c, idx) => {
      const p = availablePersonas[idx];
      if (p && p.id === id) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  updatePersonaBadge();
}

export function updatePersonaBadge() {
  if (!personaBadge) return;
  const current = availablePersonas.find((p) => p.id === selectedPersonaId);
  if (current) {
    personaBadge.innerHTML = `<span>${current.icon || '🤖'}</span> <span>${current.name}</span>`;
  } else {
    personaBadge.textContent = '⚡ Pair Dev';
  }
}

// Load Sessions List
export async function loadSessions() {
  if (activeSessionId === 'NEW_PENDING_SESSION') return;
  try {
    const res = await authFetch('/api/sessions');
    const data = await res.json();

    if (!sessionSelect) return;
    sessionSelect.innerHTML = '';
    if (data.sessions && data.sessions.length > 0) {
      data.sessions.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        const dateStr = new Date(s.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        opt.textContent = `Session ${s.id.substring(0, 8)} (${dateStr})`;
        if (s.id === data.activeConversationId) {
          opt.selected = true;
        }
        sessionSelect.appendChild(opt);
      });

      if (!activeSessionId) {
        activeSessionId = data.activeConversationId || data.sessions[0].id;
        loadMessages(activeSessionId);
      }
    } else {
      const opt = document.createElement('option');
      opt.textContent = 'No sessions';
      sessionSelect.appendChild(opt);
    }
  } catch (err) {
    console.error('Error loading sessions:', err);
  }
}

export async function loadMessages(sessionId) {
  if (!sessionId || sessionId === 'NEW_PENDING_SESSION' || !chatContainer) return;
  try {
    const res = await authFetch(`/api/sessions/${sessionId}`);
    const data = await res.json();

    chatContainer.innerHTML = '';
    data.messages.forEach((msg) => {
      renderMessage(msg.role, msg.content);
    });
    scrollToBottom();
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

// Send Prompt Handler
export async function handleSend() {
  if (!promptInput) return;
  const text = promptInput.value.trim();
  if (!text && !selectedFile) return;

  if (activeSessionId === 'NEW_PENDING_SESSION' && chatContainer) {
    chatContainer.innerHTML = '';
  }

  renderMessage('user', text || '[Attachment]');
  promptInput.value = '';
  promptInput.style.height = '42px';

  const formData = new FormData();
  if (text) formData.append('text', text);
  if (selectedFile) formData.append('image', selectedFile);
  formData.append('personaId', selectedPersonaId);
  formData.append('focusShortcut', 'Auto');

  // Clear preview
  selectedFile = null;
  if (previewArea) previewArea.style.display = 'none';

  try {
    const res = await authFetch('/api/send', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) {
      alert(`Send Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Failed to send prompt: ${err.message}`);
  }
}

export function initChatView() {
  if (sendBtn) sendBtn.addEventListener('click', handleSend);

  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    promptInput.addEventListener('input', function () {
      this.style.height = '42px';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        if (previewName) previewName.textContent = selectedFile.name;
        if (previewArea) previewArea.style.display = 'flex';
      }
    });
  }

  if (sessionSelect) {
    sessionSelect.addEventListener('change', async (e) => {
      const newId = e.target.value;
      activeSessionId = newId;
      await authFetch('/api/sessions/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: newId })
      });
      loadMessages(newId);
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', async () => {
      if (!chatContainer) return;
      chatContainer.innerHTML = '<div class="loading-state">Starting new conversation...</div>';
      try {
        const res = await authFetch('/api/sessions/new', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          activeSessionId = 'NEW_PENDING_SESSION';
          chatContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 36px 16px; margin: auto;">
              <div style="font-size: 1.8rem; margin-bottom: 8px;">✨</div>
              <div style="font-size: 1rem; font-weight: 600; color: var(--text-bright); margin-bottom: 4px;">New Conversation Started</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Send a prompt below to begin chatting with Antigravity.</div>
            </div>
          `;
        } else {
          alert(`Error starting new chat: ${data.error}`);
        }
      } catch (err) {
        alert(`Error starting new chat: ${err.message}`);
      }
    });
  }

  initVoiceDictation();
}

export function initVoiceDictation() {
  const micBtn = document.getElementById('mic-btn');
  const promptInput = document.getElementById('prompt-input');
  if (!micBtn || !promptInput) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.title = 'Voice dictation not supported in this browser';
    micBtn.style.opacity = '0.5';
    micBtn.addEventListener('click', () => {
      alert('Voice dictation requires Web Speech API (supported on Chrome, Edge, and Safari iOS 14.5+).');
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  let isListening = false;
  let basePromptText = '';

  function startListening() {
    try {
      basePromptText = promptInput.value ? promptInput.value.trim() + ' ' : '';
      recognition.start();
      isListening = true;
      micBtn.classList.add('recording');
      micBtn.title = 'Listening... Tap to finish dictation';
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
    }
  }

  function stopListening() {
    try {
      recognition.stop();
    } catch (_) {}
    isListening = false;
    micBtn.classList.remove('recording');
    micBtn.title = 'Voice Dictation (Walkie-Talkie)';
  }

  micBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let accumulatedFinal = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        accumulatedFinal += piece;
      } else {
        interimTranscript += piece;
      }
    }

    if (accumulatedFinal) {
      basePromptText += accumulatedFinal + ' ';
    }

    promptInput.value = (basePromptText + interimTranscript).trimStart();
    promptInput.style.height = '42px';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  };

  recognition.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    if (event.error !== 'no-speech') {
      stopListening();
    }
  };

  recognition.onend = () => {
    if (isListening) {
      stopListening();
    }
  };
}

