const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const { listSessions, readTranscript, DEFAULT_BRAIN_DIR } = require('./transcript/reader');
const TranscriptWatcher = require('./transcript/watcher');
const { getWorkspaceTree, getWorkspaceFileContent, WORKSPACE_ROOT } = require('./workspace/explorer');
const PromptQueue = require('./injector/queue');
const { getChatState } = require('./injector/check-chat-state');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const promptQueue = new PromptQueue();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure Multer for File & Image Uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Active state
let activeConversationId = null;

// Transcript Log Watcher
const watcher = new TranscriptWatcher({
  brainDir: DEFAULT_BRAIN_DIR,
  onNewStep: (convId, stepData) => {
    // Broadcast step to all connected WebSocket clients
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

// Auto-detect newly created sessions on disk every 1000ms
setInterval(() => {
  const sessions = listSessions(DEFAULT_BRAIN_DIR);
  if (sessions.length > 0 && sessions[0].id !== activeConversationId) {
    console.log(`[Server] Auto-detected new conversation session: ${sessions[0].id}`);
    activeConversationId = sessions[0].id;
    watcher.start(activeConversationId);

    const payload = JSON.stringify({
      type: 'SESSION_AUTO_SWITCHED',
      conversationId: activeConversationId
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}, 1000);

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

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeConversationId,
    pendingPromptsInQueue: promptQueue.getPendingCount()
  });
});

// 2. Get Live Chat State
app.get('/api/chat-state', async (req, res) => {
  const state = await getChatState();
  res.json(state);
});

// 3. Send Prompt (Text or Image or File reference)
app.post('/api/send', upload.single('image'), async (req, res) => {
  const text = req.body.text || '';
  const filePath = req.body.filePath || '';
  const focusShortcut = req.body.focusShortcut || 'Auto';
  const method = req.body.method || 'keybd_event';
  const uploadedImage = req.file ? req.file.path : null;

  if (!text && !uploadedImage && !filePath) {
    return res.status(400).json({ error: 'Must provide prompt text, image upload, or file path.' });
  }

  console.log(`[API /send] Queueing prompt - Text: "${text}", Image: "${uploadedImage}", File: "${filePath}"`);

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

  // Set pending state until first prompt creates the new session on disk
  activeConversationId = 'NEW_PENDING_SESSION';

  res.json({
    success: true,
    activeConversationId
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

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Pocket Antigravity Server running on port ${PORT}`);
  console.log(`📁 Workspace Root: ${WORKSPACE_ROOT}`);
  console.log(`🧠 Brain Transcripts: ${DEFAULT_BRAIN_DIR}`);
  console.log(`===================================================`);
});
