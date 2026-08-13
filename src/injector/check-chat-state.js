const { execFile } = require('child_process');
const path = require('path');

const PS_SCRIPT_PATH = path.join(__dirname, 'check-chat-state.ps1');

/**
 * Detects whether Antigravity IDE Chat Panel is FOCUSED, OPENED, or CLOSED.
 * @returns {Promise<{windowFound: boolean, isWindowForeground: boolean, isChatOpen: boolean, isChatFocused: boolean, stateString: string}>}
 */
function getChatState(targetTitle = 'Antigravity IDE', processName = 'Antigravity IDE') {
  return new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT_PATH,
      '-TargetTitle', targetTitle,
      '-ProcessName', processName
    ];

    execFile('powershell.exe', args, { encoding: 'utf8', timeout: 2500 }, (error, stdout, stderr) => {
      if (error) {
        if (stderr) console.error('[checkChatState] PowerShell stderr:', stderr.trim());
        return resolve({
          windowFound: false,
          isWindowForeground: false,
          isChatOpen: false,
          isChatFocused: false,
          stateString: 'CLOSED'
        });
      }

      try {
        const trimmed = (stdout || '').trim();
        const jsonMatch = trimmed.match(/\{.*\}$/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return resolve({
            windowFound: Boolean(parsed.WindowFound),
            isWindowForeground: Boolean(parsed.IsWindowForeground),
            isChatOpen: Boolean(parsed.IsChatOpen),
            isChatFocused: Boolean(parsed.IsChatFocused),
            stateString: parsed.StateString || 'CLOSED'
          });
        }
      } catch (parseErr) {
        console.error('[checkChatState] JSON Parse error:', parseErr.message, 'Output:', stdout);
      }

      resolve({
        windowFound: false,
        isWindowForeground: false,
        isChatOpen: false,
        isChatFocused: false,
        stateString: 'CLOSED'
      });
    });
  });
}

module.exports = { getChatState };
