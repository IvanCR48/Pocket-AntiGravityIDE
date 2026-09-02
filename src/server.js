const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const { listSessions, readTranscript, DEFAULT_BRAIN_DIR } = require('./transcript/reader');
const TranscriptWatcher = require('./transcript/watcher');
const { getWorkspaceTree, getWorkspaceFileContent, WORKSPACE_ROOT } = require('./workspace/explorer');
const { getWorkspaceChanges, rejectAllChanges, acceptAllChanges, getActiveWorkspaceRoot } = require('./workspace/diff');
const PromptQueue = require('./injector/queue');
const { getChatState } = require('./injector/check-chat-state');
const { loadConfig, generateToken, validateToken, requireAuth } = require('./auth/auth');

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

/**
 * Broadcasts latest workspace diffs to all authenticated WebSocket clients.
 */
async function broadcastChanges() {
  try {
    const changes = await getWorkspaceChanges();
    const payload = JSON.stringify({
      type: 'CHANGES_UPDATED',
      changes
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
        client.send(payload);
      }
    });
  } catch (_) {}
}

// Transcript Log Watcher
const watcher = new TranscriptWatcher({
  brainDir: DEFAULT_BRAIN_DIR,
  onNewStep: (convId, stepData) => {
    // Broadcast step to all authenticated WebSocket clients
    const payload = JSON.stringify({
      type: 'TRANSCRIPT_STEP',
      conversationId: convId,
      step: stepData
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
        client.send(payload);
      }
    });

    // Check if step modified files
    if (stepData.type === 'PLANNER_RESPONSE' || stepData.status === 'DONE') {
      setTimeout(broadcastChanges, 500);
    }
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
      if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
        client.send(payload);
      }
    });
  }
}, 1000);

// Background chat state & diffs broadcaster
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
      if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
        client.send(payload);
      }
    });

    // Poll git diffs every 3s
    broadcastChanges();
  }
}, 3000);

// WebSocket Connection Handler
wss.on('connection', async (ws, req) => {
  const config = loadConfig();
  
  // Check token from query param (e.g. /ws?token=...)
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const token = urlParams.get('token');

  if (!config.pin || validateToken(token)) {
    ws.isAuthenticated = true;
    const changes = await getWorkspaceChanges();
    ws.send(JSON.stringify({
      type: 'INIT',
      activeConversationId,
      chatState: currentChatState,
      changes
    }));
  } else {
    ws.isAuthenticated = false;
    ws.send(JSON.stringify({
      type: 'AUTH_REQUIRED',
      error: 'Authentication required. Please enter your PIN.'
    }));
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'AUTH') {
        if (validateToken(data.token)) {
          ws.isAuthenticated = true;
          const changes = await getWorkspaceChanges();
          ws.send(JSON.stringify({
            type: 'INIT',
            activeConversationId,
            chatState: currentChatState,
            changes
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'AUTH_FAILED',
            error: 'Invalid token.'
          }));
        }
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected.');
  });
});

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 0. Authentication Endpoints
app.get('/api/auth/status', (req, res) => {
  const config = loadConfig();
  res.json({
    authRequired: Boolean(config.pin)
  });
});

app.post('/api/auth/verify', (req, res) => {
  const config = loadConfig();
  const inputPin = String(req.body.pin || '').trim();

  if (!config.pin || inputPin === String(config.pin)) {
    const token = generateToken(config.pin || 'OPEN');
    return res.json({
      success: true,
      token
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Incorrect PIN. Access denied.'
  });
});

// 1. Health Check (Public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeConversationId,
    pendingPromptsInQueue: promptQueue.getPendingCount()
  });
});

// 2. Get Live Chat State (Protected)
app.get('/api/chat-state', requireAuth, async (req, res) => {
  const state = await getChatState();
  res.json(state);
});

// 3. Send Prompt (Text or Image or File reference) (Protected)
app.post('/api/send', requireAuth, upload.single('image'), async (req, res) => {
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

// 4. List conversation sessions (Protected)
app.get('/api/sessions', requireAuth, (req, res) => {
  const sessions = listSessions(DEFAULT_BRAIN_DIR);
  res.json({ sessions, activeConversationId });
});

// 5. Get transcript messages for a session (Protected)
app.get('/api/sessions/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const messages = await readTranscript(id, DEFAULT_BRAIN_DIR);
  res.json({ conversationId: id, messages });
});

// 6. Switch active watched session (Protected)
app.post('/api/sessions/switch', requireAuth, (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: 'Missing conversationId parameter.' });
  }

  activeConversationId = conversationId;
  watcher.start(activeConversationId);

  res.json({ success: true, activeConversationId });
});

// 7. Create New Chat Session (Protected)
app.post('/api/sessions/new', requireAuth, async (req, res) => {
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

// 8. Get Workspace File Tree (Protected)
app.get('/api/workspace/tree', requireAuth, (req, res) => {
  const root = getActiveWorkspaceRoot();
  const tree = getWorkspaceTree(root);
  res.json({ workspaceRoot: root, tree });
});

// 9. Get Workspace File Content (Protected)
app.get('/api/workspace/file', requireAuth, (req, res) => {
  const relPath = req.query.path;
  if (!relPath) {
    return res.status(400).json({ error: 'Missing path parameter.' });
  }

  const root = getActiveWorkspaceRoot();
  const fileData = getWorkspaceFileContent(root, relPath);
  if (fileData.success) {
    res.json(fileData);
  } else {
    res.status(400).json(fileData);
  }
});

// 10. Get Workspace Changes & Diffs (Protected)
app.get('/api/changes', requireAuth, async (req, res) => {
  const changes = await getWorkspaceChanges();
  res.json(changes);
});

// 11. Accept All Changes (Protected)
app.post('/api/changes/accept', requireAuth, async (req, res) => {
  const result = await acceptAllChanges();
  await broadcastChanges();
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// 12. Reject All Changes (Protected)
app.post('/api/changes/reject', requireAuth, async (req, res) => {
  const result = await rejectAllChanges();
  await broadcastChanges();
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// Start Server
const config = loadConfig();
const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  const root = getActiveWorkspaceRoot();
  console.log(`===================================================`);
  console.log(`🚀 Pocket Antigravity Server running on port ${PORT}`);
  console.log(`🔒 Security PIN: ${config.pin ? 'ENABLED (Configured in pocket.config.json)' : 'DISABLED (Open Access)'}`);
  console.log(`📁 Workspace Root: ${root}`);
  console.log(`🧠 Brain Transcripts: ${DEFAULT_BRAIN_DIR}`);
  console.log(`===================================================`);
});
