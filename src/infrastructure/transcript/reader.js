const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Default Antigravity Brain Directory
const DEFAULT_BRAIN_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Danie',
  '.gemini',
  'antigravity-ide',
  'brain'
);

/**
 * Discovers all conversation IDs in the brain directory, sorted by last modified time (newest first).
 * @param {string} [brainDir]
 * @returns {Array<{id: string, mtime: Date, promptSnippet: string}>}
 */
function listSessions(brainDir = DEFAULT_BRAIN_DIR) {
  if (!fs.existsSync(brainDir)) return [];

  try {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true });
    const sessions = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'scratch') {
        const sessionPath = path.join(brainDir, entry.name);
        const transcriptPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');

        let mtime = new Date(0);
        let snippet = "Empty conversation";

        try {
          const stats = fs.statSync(sessionPath);
          mtime = stats.mtime;

          if (fs.existsSync(transcriptPath)) {
            const fileStats = fs.statSync(transcriptPath);
            if (fileStats.mtime > mtime) mtime = fileStats.mtime;

            const content = fs.readFileSync(transcriptPath, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'USER_INPUT' && parsed.content) {
                  snippet = typeof parsed.content === 'string' 
                    ? parsed.content.substring(0, 80) 
                    : JSON.stringify(parsed.content).substring(0, 80);
                  break;
                }
              } catch (_) {}
            }
          }
        } catch (_) {}

        sessions.push({
          id: entry.name,
          mtime,
          promptSnippet: snippet
        });
      }
    }

    sessions.sort((a, b) => b.mtime - a.mtime);
    return sessions;
  } catch (err) {
    console.error("Error listing sessions:", err);
    return [];
  }
}

/**
 * Reads full transcript steps for a specific conversation ID.
 * @param {string} conversationId
 * @param {string} [brainDir]
 * @returns {Promise<Array<{stepIndex: number, role: string, content: string, type: string, toolCalls: Array, timestamp: string}>>}
 */
async function readTranscript(conversationId, brainDir = DEFAULT_BRAIN_DIR) {
  const transcriptPath = path.join(brainDir, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) return [];

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const messages = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      let role = 'system';
      if (parsed.type === 'USER_INPUT' || parsed.source === 'USER_EXPLICIT') {
        role = 'user';
      } else if (parsed.type === 'PLANNER_RESPONSE' || parsed.source === 'MODEL') {
        role = 'assistant';
      }

      let contentText = '';
      if (typeof parsed.content === 'string') {
        contentText = parsed.content;
      } else if (parsed.content) {
        contentText = JSON.stringify(parsed.content);
      }

      messages.push({
        stepIndex: parsed.step_index ?? messages.length,
        role,
        type: parsed.type || 'UNKNOWN',
        content: contentText,
        toolCalls: parsed.tool_calls || [],
        status: parsed.status || 'DONE'
      });
    } catch (_) {}
  }

  return messages;
}

module.exports = {
  DEFAULT_BRAIN_DIR,
  listSessions,
  readTranscript
};
