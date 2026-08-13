const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { focusWindow } = require('./injector/window-finder');
const { getChatState } = require('./injector/check-chat-state');
const PromptQueue = require('./injector/queue');
const { listSessions, readTranscript, DEFAULT_BRAIN_DIR } = require('./transcript/reader');
const { getWorkspaceTree, getWorkspaceFileContent } = require('./workspace/explorer');
const TranscriptWatcher = require('./transcript/watcher');

const PORT = process.env.PORT || 3000;
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const UPLOAD_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
  }
});
const upload = multer({ storage });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize FIFO Prompt Queue
const promptQueue = new PromptQueue();

// Real-time transcript watcher instance
let activeConversationId = null;
const watcher = new TranscriptWatcher({
  brainDir: DEFAULT_BRAIN_DIR,
  onNewStep: (convId, stepData) => {
    // Detect agent activity state
    const isAssistantStep = stepData.type === 'PLANNER_RESPONSE' || stepData.source === 'MODEL';
    promptQueue.setAgentBusy(isAssistantStep);

    const payload = JSON.stringify({
      type: 'TRANSCRIPT_STEP',
      conversationId: convId,
      step: stepData
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
});

// Auto-start watcher on newest session
const initialSessions = listSessions(DEFAULT_BRAIN_DIR);
if (initialSessions.length > 0) {
  activeConversationId = initialSessions[0].id;
  watcher.start(activeConversationId);
}

// Background chat state broadcaster
let currentChatState = { stateString: 'UNKNOWN', isChatOpen: false, isChatFocused: false };
setInterval(async () => {
  if (wss.clients.size > 0) {
    const state = await getChatState();
    currentChatState = state;
    const payload = JSON.stringify({
      type: 'CHAT_STATE_UPDATE',
      state: state
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}, 3000);

// REST API Endpoints

// 1. Status endpoint
app.get('/api/status', async (req, res) => {
  const winStatus = await focusWindow({ targetTitle: 'Antigravity IDE', processName: 'Antigravity IDE' });
  const chatState = await getChatState();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeConversationId,
    pendingPromptsInQueue: promptQueue.getPendingCount(),
    chatState: chatState,
    window: winStatus
  });
});

// 2. Chat State endpoint
app.get('/api/chat-state', async (req, res) => {
  const state = await getChatState();
  res.json(state);
});

// 3. Send prompt (Queued via PromptQueue)
app.post('/api/send', upload.single('image'), async (req, res) => {
  const text = req.body.text || req.body.prompt || '';
  const filePath = req.body.filePath || '';
  const uploadedImage = req.file ? req.file.path : (req.body.imagePath || '');
  const focusShortcut = req.body.focusShortcut || 'Auto';
  const method = req.body.method || 'keybd_event';

  if (!text && !uploadedImage && !filePath) {
    return res.status(400).json({ error: 'Must provide prompt text, image upload, or file path.' });
  }

  console.log(`[API /send] Queueing prompt - Text: "${text}", Image: "${uploadedImage}", File: "${filePath}"`);

  // Enqueue prompt for sequential injection
  const result = await promptQueue.enqueue({
    text,
    filePath,
    uploadedImage,
    focusShortcut,
    method,
    newChat: false
  });

  if (result.success) {
    res.json({ success: true, pendingInQueue: promptQueue.getPendingCount(), result });
  } else {
    res.status(500).json({ success: false, error: result.error, result });
  }
});

// 4. List conversation sessions
app.get('/api/sessions', (req, res) => {
  const sessions = listSessions(DEFAULT_BRAIN_DIR);
  res.json({ sessions, activeConversationId });
});

// 5. Get transcript messages for a session
app.get('/api/sessions/:id', async (req, res) => {
  const id = req.params.id;
  const messages = await readTranscript(id, DEFAULT_BRAIN_DIR);
  res.json({ conversationId: id, messages });
});

// 6. Switch active watched session
app.post('/api/sessions/switch', (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: 'Missing conversationId parameter.' });
  }

  activeConversationId = conversationId;
  watcher.start(activeConversationId);

  res.json({ success: true, activeConversationId });
});

// 7. Create New Chat Session (Queued)
app.post('/api/sessions/new', async (req, res) => {
  console.log('[API /sessions/new] Queueing New Chat in Antigravity IDE...');

  const result = await promptQueue.enqueue({
    newChat: true
  });

  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error });
  }

  // Wait 1000ms for the IDE to create the new session on disk
  await new Promise(r => setTimeout(r, 1000));

  const sessions = listSessions(DEFAULT_BRAIN_DIR);
  if (sessions.length > 0) {
    activeConversationId = sessions[0].id;
    watcher.start(activeConversationId);
  }

  res.json({
    success: true,
    activeConversationId,
    sessions
  });
});

// 8. Get Workspace File Tree
app.get('/api/workspace/tree', (req, res) => {
  const tree = getWorkspaceTree(WORKSPACE_ROOT);
  res.json({ workspaceRoot: WORKSPACE_ROOT, tree });
});

// 9. Get Workspace File Content
app.get('/api/workspace/file', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) {
    return res.status(400).json({ error: 'Missing path parameter.' });
  }

  const fileData = getWorkspaceFileContent(WORKSPACE_ROOT, relPath);
  if (fileData.success) {
    res.json(fileData);
  } else {
    res.status(400).json(fileData);
  }
});

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected.');

  ws.send(JSON.stringify({
    type: 'INIT',
    activeConversationId,
    chatState: currentChatState
  }));

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected.');
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Pocket Antigravity Server running on port ${PORT}`);
  console.log(`- Local URL: http://localhost:${PORT}`);
  console.log(`- WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`- Workspace: ${WORKSPACE_ROOT}`);
  console.log(`- Active Session: ${activeConversationId || 'None'}`);
  console.log(`==================================================\n`);
});
