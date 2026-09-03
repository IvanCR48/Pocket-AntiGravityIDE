const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Core Use Cases
const { SendPromptUseCase } = require('./core/usecases/send-prompt.usecase');
const { ReviewChangesUseCase } = require('./core/usecases/review-changes.usecase');
const { ManageSessionsUseCase } = require('./core/usecases/manage-sessions.usecase');
const { ManagePersonasUseCase } = require('./core/usecases/manage-personas.usecase');

// Outbound Infrastructure Adapters
const { Win32AutomationAdapter } = require('./infrastructure/automation/win32-automation.adapter');
const { GitAdapter } = require('./infrastructure/vcs/git.adapter');
const { JsonlTranscriptAdapter, DEFAULT_BRAIN_DIR } = require('./infrastructure/transcript/jsonl-transcript.adapter');

// Inbound Primary Interfaces
const { createAuthRoutes } = require('./interfaces/http/routes/auth.routes');
const { createChangesRoutes } = require('./interfaces/http/routes/changes.routes');
const { createSessionsRoutes } = require('./interfaces/http/routes/sessions.routes');
const { createWorkspaceRoutes } = require('./interfaces/http/routes/workspace.routes');
const { createPromptRoutes } = require('./interfaces/http/routes/prompt.routes');
const { createPersonasRoutes } = require('./interfaces/http/routes/personas.routes');
const { WebSocketServerHandler } = require('./interfaces/websockets/websocket-server');

const { loadConfig } = require('./infrastructure/security/pin-auth');
const { getActiveWorkspaceRoot } = require('./infrastructure/workspace/resolver');

// ----------------------------------------------------
// 1. Dependency Injection Setup (Composition Root)
// ----------------------------------------------------
const ideAutomationAdapter = new Win32AutomationAdapter();
const vcsAdapter = new GitAdapter();
const transcriptAdapter = new JsonlTranscriptAdapter(DEFAULT_BRAIN_DIR);

const managePersonasUseCase = new ManagePersonasUseCase();
const sendPromptUseCase = new SendPromptUseCase(ideAutomationAdapter, managePersonasUseCase);
const reviewChangesUseCase = new ReviewChangesUseCase({
  vcsPort: vcsAdapter,
  ideAutomationPort: ideAutomationAdapter
});
const manageSessionsUseCase = new ManageSessionsUseCase({
  transcriptPort: transcriptAdapter,
  ideAutomationPort: ideAutomationAdapter
});

// Active Session State
let activeConversationId = null;
const initialSessions = manageSessionsUseCase.listSessions();
if (initialSessions.length > 0) {
  activeConversationId = initialSessions[0].id;
}

// ----------------------------------------------------
// 2. HTTP & WebSocket Server Setup
// ----------------------------------------------------
const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure Multer
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// WebSocket Handler
const wsHandler = new WebSocketServerHandler({
  server,
  reviewChangesUseCase,
  ideAutomationPort: ideAutomationAdapter,
  getActiveSessionId: () => activeConversationId
});

// Transcript Watcher Hook
function startSessionWatcher(sessionId) {
  if (!sessionId || sessionId === 'NEW_PENDING_SESSION') return;
  manageSessionsUseCase.watchSession(sessionId, (convId, stepData) => {
    wsHandler.broadcast({
      type: 'TRANSCRIPT_STEP',
      conversationId: convId,
      step: stepData
    });
    if (stepData.type === 'PLANNER_RESPONSE' || stepData.status === 'DONE') {
      setTimeout(() => wsHandler.broadcastChanges(), 500);
    }
  });
}
if (activeConversationId) startSessionWatcher(activeConversationId);

// Auto-detect new sessions on disk
setInterval(() => {
  const sessions = manageSessionsUseCase.listSessions();
  if (sessions.length > 0 && sessions[0].id !== activeConversationId) {
    console.log(`[Hexagonal-Server] Auto-detected new session: ${sessions[0].id}`);
    activeConversationId = sessions[0].id;
    startSessionWatcher(activeConversationId);
    wsHandler.broadcast({
      type: 'SESSION_AUTO_SWITCHED',
      conversationId: activeConversationId
    });
  }
}, 1000);

// ----------------------------------------------------
// 3. Mount Modular Routes
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    architecture: 'hexagonal',
    activeConversationId,
    pendingPromptsInQueue: ideAutomationAdapter.getPendingQueueCount()
  });
});

app.use('/api/auth', createAuthRoutes());
app.use('/api/changes', createChangesRoutes({
  reviewChangesUseCase,
  onChangesBroadcast: () => wsHandler.broadcastChanges()
}));
app.use('/api/sessions', createSessionsRoutes({
  manageSessionsUseCase,
  getActiveSessionId: () => activeConversationId,
  setActiveSessionId: (newId) => {
    activeConversationId = newId;
    startSessionWatcher(newId);
  }
}));
app.use('/api/workspace', createWorkspaceRoutes());
app.use('/api/personas', createPersonasRoutes({ managePersonasUseCase }));
app.use('/api', createPromptRoutes({
  sendPromptUseCase,
  ideAutomationPort: ideAutomationAdapter,
  upload
}));

// ----------------------------------------------------
// 4. Start Server
// ----------------------------------------------------
const config = loadConfig();
const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  const root = getActiveWorkspaceRoot();
  console.log(`===================================================`);
  console.log(`🚀 Pocket Antigravity [Hexagonal Architecture] Port: ${PORT}`);
  console.log(`🔒 Security PIN: ${config.pin ? 'ENABLED' : 'DISABLED'}`);
  console.log(`📁 Active Workspace: ${root}`);
  console.log(`🧠 Brain Logs: ${DEFAULT_BRAIN_DIR}`);
  console.log(`===================================================`);
});
