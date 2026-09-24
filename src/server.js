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
const { SystemDoctor } = require('./infrastructure/system/doctor');
const { TunnelManager } = require('./infrastructure/system/tunnel-manager');
const { getLogoBanner, box, COLORS, rgb, BOLD, RESET, DIM } = require('./infrastructure/terminal/theme');

// Inbound Primary Interfaces
const { createAuthRoutes } = require('./interfaces/http/routes/auth.routes');
const { createChangesRoutes } = require('./interfaces/http/routes/changes.routes');
const { createSessionsRoutes } = require('./interfaces/http/routes/sessions.routes');
const { createWorkspaceRoutes } = require('./interfaces/http/routes/workspace.routes');
const { createPromptRoutes } = require('./interfaces/http/routes/prompt.routes');
const { createPersonasRoutes } = require('./interfaces/http/routes/personas.routes');
const { createSystemRoutes } = require('./interfaces/http/routes/system.routes');
const { WebSocketServerHandler } = require('./interfaces/websockets/websocket-server');

const { loadConfig } = require('./infrastructure/security/pin-auth');
const { getActiveWorkspaceRoot } = require('./infrastructure/workspace/resolver');

// ----------------------------------------------------
// 1. Composition Root (El cableado de dependencias)
// Acá se enchufa todo: instanciamos los adaptadores que tocan fierros del SO
// (Win32, Git CLI, logs de disco) y se los inyectamos a los Casos de Uso del core.
// Ningún endpoint HTTP toca el sistema operativo de forma directa; todo pasa por este desacoplamiento.
// ----------------------------------------------------
const ideAutomationAdapter = new Win32AutomationAdapter();
const vcsAdapter = new GitAdapter();
const transcriptAdapter = new JsonlTranscriptAdapter(DEFAULT_BRAIN_DIR);
const systemDoctor = new SystemDoctor();
const tunnelManager = new TunnelManager();

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
const knownSessionIds = new Set(initialSessions.map((s) => s.id));
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

// Auto-detect genuinely brand-new sessions created on disk
setInterval(() => {
  const sessions = manageSessionsUseCase.listSessions();
  const currentIds = new Set(sessions.map((s) => s.id));

  // Prune deleted sessions from knownSessionIds
  for (const id of knownSessionIds) {
    if (!currentIds.has(id)) {
      knownSessionIds.delete(id);
    }
  }

  // Find if there is a session on disk that was NOT known previously
  const brandNewSession = sessions.find((s) => !knownSessionIds.has(s.id));

  if (brandNewSession) {
    console.log(`[Hexagonal-Server] Auto-detected brand-new session on disk: ${brandNewSession.id}`);
    knownSessionIds.add(brandNewSession.id);
    activeConversationId = brandNewSession.id;
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
    if (newId && newId !== 'NEW_PENDING_SESSION') {
      knownSessionIds.add(newId);
    }
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
app.use('/api/system', createSystemRoutes({
  systemDoctor,
  tunnelManager,
  getActiveSessionId: () => activeConversationId,
  getClientCount: () => wsHandler.getClientCount()
}));

// Dashboard Redirect
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard', 'index.html'));
});

// ----------------------------------------------------
// 4. Arranque del Servidor
// Levantamos Express + WebSockets y mostramos la URL de LAN calculada por el Doctor.
// Si el usuario configuró "preventSleep", activamos la trampa de energía de Windows
// para que la laptop no se suspenda a mitad de una tarea larga mientras estamos en el sillón.
// ----------------------------------------------------
const config = loadConfig();
if (config.preventSleep) {
  systemDoctor.setKeepAwake(true);
}

const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  const root = getActiveWorkspaceRoot();
  const netInfo = systemDoctor.getNetworkInfo(PORT);
  
  console.log('\n' + getLogoBanner() + '\n');
  console.log(box([
    `🚀 ${BOLD}Pocket Antigravity Host Engine${RESET}  ${rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '[ONLINE]')}`,
    ``,
    `🎛️  ${BOLD}Control Center:${RESET}    ${rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], `http://localhost:${PORT}/dashboard`)}`,
    `📱 ${BOLD}Local Wi-Fi URL:${RESET}   ${rgb(COLORS.blurple[0], COLORS.blurple[1], COLORS.blurple[2], netInfo.primaryUrl)}`,
    `🔒 ${BOLD}Security PIN:${RESET}      ${config.pin ? rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], 'ENABLED (Protected)') : rgb(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], 'DISABLED')}`,
    `📁 ${BOLD}Workspace:${RESET}         ${DIM}${root}${RESET}`,
    `🧠 ${BOLD}Brain Logs:${RESET}        ${DIM}${DEFAULT_BRAIN_DIR}${RESET}`
  ], { title: `POCKET ANTIGRAVITY v1.6.0 [PORT ${PORT}]`, borderColor: COLORS.blurple }) + '\n');
});
