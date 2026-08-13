let activeSessionId = null;
let selectedFile = null;
let currentViewingFilePath = null;
let ws = null;

// DOM Elements
const chatContainer = document.getElementById('chat-container');
const filesContainer = document.getElementById('files-container');
const fileTreeEl = document.getElementById('file-tree');
const tabChatBtn = document.getElementById('tab-chat-btn');
const tabFilesBtn = document.getElementById('tab-files-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const refreshFilesBtn = document.getElementById('refresh-files-btn');

const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const sessionSelect = document.getElementById('session-select');
const focusShortcutSelect = document.getElementById('focus-shortcut-select');
const statusBadge = document.getElementById('status-badge');
const chatStateBadge = document.getElementById('chat-state-badge');
const previewArea = document.getElementById('attachment-preview');
const previewName = document.getElementById('preview-name');

// Modal Elements
const fileModal = document.getElementById('file-viewer-modal');
const modalFileTitle = document.getElementById('modal-file-title');
const modalFileBody = document.getElementById('modal-file-body');
const closeModalBtn = document.getElementById('close-modal-btn');
const attachFilePromptBtn = document.getElementById('attach-file-prompt-btn');

// Configure Marked.js options if available
if (typeof marked !== 'undefined') {
  marked.setOptions({
    gfm: true,
    breaks: true
  });
}

/**
 * Render Markdown text into formatted HTML with fallback regex parser.
 * @param {string} text
 * @returns {string}
 */
function parseMarkdown(text) {
  if (!text) return '';

  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    let html = marked.parse(text);
    return postProcessCodeBlocks(html);
  }

  // Fallback Lightweight Markdown Parser
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Horizontal rules & Lists
  html = html.replace(/^\-\-\-$/gim, '<hr>');
  html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\n<ul>/g, '');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return postProcessCodeBlocks(html);
}

/**
 * Wraps code blocks with custom headers and copy buttons.
 */
function postProcessCodeBlocks(html) {
  return html.replace(/<pre><code(?:\s+class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
    const language = lang || 'code';
    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>${language}</span>
          <button class="code-copy-btn" onclick="copyCodeSnippet(this)">Copy</button>
        </div>
        <pre class="code-block"><code>${code}</code></pre>
      </div>
    `;
  });
}

// Global Copy Helper
window.copyCodeSnippet = function(btn) {
  const wrapper = btn.closest('.code-block-wrapper');
  if (!wrapper) return;
  const codeText = wrapper.querySelector('code').innerText;
  navigator.clipboard.writeText(codeText).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
};

// Update Chat State Badge
function updateChatStateBadge(state) {
  if (!chatStateBadge || !state) return;
  const dot = chatStateBadge.querySelector('.status-dot');
  const text = chatStateBadge.querySelector('span:last-child');
  if (!dot || !text) return;

  if (state.isChatFocused) {
    dot.style.background = '#10b981';
    dot.style.boxShadow = '0 0 8px #10b981';
    text.textContent = 'Chat: Focused';
    chatStateBadge.style.color = '#10b981';
  } else if (state.isChatOpen) {
    dot.style.background = '#f59e0b';
    dot.style.boxShadow = '0 0 8px #f59e0b';
    text.textContent = 'Chat: Opened';
    chatStateBadge.style.color = '#f59e0b';
  } else {
    dot.style.background = '#a1a1aa';
    dot.style.boxShadow = 'none';
    text.textContent = 'Chat: Closed';
    chatStateBadge.style.color = '#a1a1aa';
  }
}

// 1. Tab Switcher
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

refreshFilesBtn.addEventListener('click', loadWorkspaceTree);

// 2. Initialize WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    statusBadge.innerHTML = '<span class="status-dot"></span> <span>Connected</span>';
    statusBadge.style.color = '#10b981';
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'TRANSCRIPT_STEP') {
        appendMessageFromStep(data.step);
      } else if (data.type === 'CHAT_STATE_UPDATE') {
        updateChatStateBadge(data.state);
      } else if (data.type === 'INIT') {
        if (data.chatState) updateChatStateBadge(data.chatState);
      }
    } catch (e) {
      console.error("WS Message Error:", e);
    }
  };

  ws.onclose = () => {
    statusBadge.innerHTML = '<span class="status-dot" style="background:#ef4444"></span> <span>Disconnected</span>';
    statusBadge.style.color = '#ef4444';
    setTimeout(initWebSocket, 3000);
  };
}

// 3. Load Workspace File Tree
async function loadWorkspaceTree() {
  fileTreeEl.innerHTML = '<div class="loading-state">Loading workspace files...</div>';
  try {
    const res = await fetch('/api/workspace/tree');
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data.tree) {
        fileTreeEl.innerHTML = '';
        renderTreeNodes(data.tree, fileTreeEl);
      } else {
        fileTreeEl.innerHTML = `<div class="loading-state" style="color:#ef4444">Server response: ${data.error || text}</div>`;
      }
    } catch (_) {
      fileTreeEl.innerHTML = `<div class="loading-state" style="color:#ef4444">Please restart node src/server.js to load file tree.</div>`;
    }
  } catch (err) {
    fileTreeEl.innerHTML = `<div class="loading-state" style="color:#ef4444">Error loading files: ${err.message}</div>`;
  }
}

function renderTreeNodes(nodes, container) {
  nodes.forEach((node) => {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';

    if (node.type === 'directory') {
      const dirHeader = document.createElement('div');
      dirHeader.className = 'tree-item directory';
      dirHeader.innerHTML = `📁 <span>${node.name}</span>`;

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      childrenContainer.style.display = 'none';

      dirHeader.addEventListener('click', () => {
        const isHidden = childrenContainer.style.display === 'none';
        childrenContainer.style.display = isHidden ? 'block' : 'none';
        dirHeader.innerHTML = `${isHidden ? '📂' : '📁'} <span>${node.name}</span>`;
      });

      renderTreeNodes(node.children, childrenContainer);
      nodeEl.appendChild(dirHeader);
      nodeEl.appendChild(childrenContainer);
    } else {
      const fileItem = document.createElement('div');
      fileItem.className = 'tree-item file';
      const formattedSize = node.size > 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${node.size} B`;
      fileItem.innerHTML = `📄 <span>${node.name}</span> <span class="file-size">${formattedSize}</span>`;

      fileItem.addEventListener('click', () => openFileModal(node.path));
      nodeEl.appendChild(fileItem);
    }

    container.appendChild(nodeEl);
  });
}

// 4. Open File Content Viewer Modal
async function openFileModal(relativePath) {
  currentViewingFilePath = relativePath;
  modalFileTitle.textContent = relativePath;
  modalFileBody.textContent = 'Loading file content...';
  fileModal.style.display = 'flex';

  try {
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(relativePath)}`);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data.success) {
        modalFileBody.textContent = data.content;
      } else {
        modalFileBody.textContent = `Error: ${data.error}`;
      }
    } catch (_) {
      modalFileBody.textContent = `Error reading file. Response: ${text}`;
    }
  } catch (err) {
    modalFileBody.textContent = `Failed to load file: ${err.message}`;
  }
}

closeModalBtn.addEventListener('click', () => {
  fileModal.style.display = 'none';
});

attachFilePromptBtn.addEventListener('click', () => {
  if (currentViewingFilePath) {
    const ref = `@${currentViewingFilePath}`;
    if (promptInput.value.trim()) {
      promptInput.value += ` ${ref}`;
    } else {
      promptInput.value = `Check file ${ref}`;
    }
    fileModal.style.display = 'none';

    // Switch back to Chat tab
    tabChatBtn.click();
    promptInput.focus();
  }
});

// 5. Load Sessions List
async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();

    sessionSelect.innerHTML = '';
    data.sessions.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.promptSnippet || s.id.substring(0, 8)}...`;
      if (s.id === data.activeConversationId) {
        opt.selected = true;
        activeSessionId = s.id;
      }
      sessionSelect.appendChild(opt);
    });

    if (activeSessionId) {
      loadMessages(activeSessionId);
    }
  } catch (err) {
    console.error("Error loading sessions:", err);
  }
}

// 6. Handle New Chat Session
if (newChatBtn) {
  newChatBtn.addEventListener('click', async () => {
    const origText = newChatBtn.textContent;
    newChatBtn.textContent = '⏳ Creating...';

    try {
      const res = await fetch('/api/sessions/new', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        chatContainer.innerHTML = '';
        activeSessionId = data.activeConversationId;
        await loadSessions();
        renderMessage('assistant', '✨ Started a new chat session in Antigravity IDE!');
      } else {
        alert(`New Chat Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Failed to create new chat: ${err.message}`);
    } finally {
      newChatBtn.textContent = origText;
    }
  });
}

// 7. Load Session Messages
async function loadMessages(sessionId) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();

    chatContainer.innerHTML = '';
    data.messages.forEach((msg) => {
      renderMessage(msg.role, msg.content);
    });
    scrollToBottom();
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

// 8. Render Formatted Message in Chat
function renderMessage(role, text) {
  if (!text) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = role === 'user' ? 'You (Phone)' : 'Antigravity IDE Assistant';

  const body = document.createElement('div');
  body.className = 'message-body';
  body.innerHTML = parseMarkdown(text);

  msgDiv.appendChild(meta);
  msgDiv.appendChild(body);
  chatContainer.appendChild(msgDiv);
  scrollToBottom();
}

function appendMessageFromStep(step) {
  let role = 'assistant';
  if (step.type === 'USER_INPUT' || step.source === 'USER_EXPLICIT') {
    role = 'user';
  }
  let text = typeof step.content === 'string' ? step.content : JSON.stringify(step.content);
  if (text) {
    renderMessage(role, text);
  }
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 9. Send Prompt Handler
async function handleSend() {
  const text = promptInput.value.trim();
  if (!text && !selectedFile) return;

  renderMessage('user', text || '[Attachment]');
  promptInput.value = '';
  promptInput.style.height = '48px';

  const formData = new FormData();
  if (text) formData.append('text', text);
  if (selectedFile) formData.append('image', selectedFile);
  if (focusShortcutSelect) formData.append('focusShortcut', focusShortcutSelect.value);

  // Clear preview
  selectedFile = null;
  previewArea.style.display = 'none';

  try {
    const res = await fetch('/api/send', {
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

// Event Listeners
sendBtn.addEventListener('click', handleSend);

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    previewName.textContent = selectedFile.name;
    previewArea.style.display = 'flex';
  }
});

sessionSelect.addEventListener('change', async (e) => {
  const newId = e.target.value;
  activeSessionId = newId;
  await fetch('/api/sessions/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: newId })
  });
  loadMessages(newId);
});

// Auto-expand textarea
promptInput.addEventListener('input', function () {
  this.style.height = '48px';
  this.style.height = Math.min(this.scrollHeight, 130) + 'px';
});

// Boot
initWebSocket();
loadSessions();
