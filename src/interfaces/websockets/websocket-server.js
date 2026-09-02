const WebSocket = require('ws');
const { loadConfig, validateToken } = require('../../infrastructure/security/pin-auth');
const { getActiveWorkspaceRoot } = require('../../infrastructure/workspace/resolver');

class WebSocketServerHandler {
  constructor({ server, reviewChangesUseCase, ideAutomationPort, getActiveSessionId }) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.reviewChanges = reviewChangesUseCase;
    this.ideAutomation = ideAutomationPort;
    this.getActiveSessionId = getActiveSessionId;

    this.currentChatState = { stateString: 'UNKNOWN', isChatOpen: false, isChatFocused: false };

    this.init();
  }

  init() {
    this.wss.on('connection', async (ws, req) => {
      const config = loadConfig();
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      const token = urlParams.get('token');

      if (!config.pin || validateToken(token)) {
        ws.isAuthenticated = true;
        const changes = await this.reviewChanges.getChanges(getActiveWorkspaceRoot());
        ws.send(JSON.stringify({
          type: 'INIT',
          activeConversationId: this.getActiveSessionId(),
          chatState: this.currentChatState,
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
              const changes = await this.reviewChanges.getChanges(getActiveWorkspaceRoot());
              ws.send(JSON.stringify({
                type: 'INIT',
                activeConversationId: this.getActiveSessionId(),
                chatState: this.currentChatState,
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

      ws.on('close', () => {});
    });

    // Chat state & diffs broadcaster loop
    setInterval(async () => {
      if (this.wss.clients.size > 0) {
        const state = await this.ideAutomation.getChatState();
        this.currentChatState = state;
        this.broadcast({
          type: 'CHAT_STATE_UPDATE',
          state
        });
        this.broadcastChanges();
      }
    }, 3000);
  }

  broadcast(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
        client.send(raw);
      }
    });
  }

  async broadcastChanges() {
    try {
      const changes = await this.reviewChanges.getChanges(getActiveWorkspaceRoot());
      this.broadcast({
        type: 'CHANGES_UPDATED',
        changes
      });
    } catch (_) {}
  }
}

module.exports = { WebSocketServerHandler };
