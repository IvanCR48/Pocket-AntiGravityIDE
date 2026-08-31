# ⚡ Antigravity IDE — Complete Keybindings & Commands Cheatsheet

> Authoritative reference guide of all native keyboard shortcuts, Command Palette actions, agent review controls, slash commands, and `@` mentions in **Antigravity IDE**.

---

## 🤖 1. AI Modalities & Core Agent Shortcuts

| Action | Windows / Linux Shortcut | macOS Shortcut | Context / Description |
| :--- | :--- | :--- | :--- |
| **New Conversation** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Starts a fresh chat session with the AI agent. |
| **Focus Prompt / Chat Input** | <kbd>Ctrl</kbd> + <kbd>L</kbd> | <kbd>Cmd</kbd> + <kbd>L</kbd> | Locks focus into the prompt text area. |
| **Inline AI Command** | <kbd>Ctrl</kbd> + <kbd>I</kbd> | <kbd>Cmd</kbd> + <kbd>I</kbd> | Opens the inline prompt widget on the active line or selection. |
| **Accept Inline Suggestion** | <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | <kbd>Cmd</kbd> + <kbd>Enter</kbd> | Confirms code generated in the inline widget. |
| **Dismiss Inline Suggestion** | <kbd>Escape</kbd> | <kbd>Escape</kbd> | Discards the active inline edit. |
| **Focus First Editor Group** | <kbd>Ctrl</kbd> + <kbd>1</kbd> | <kbd>Cmd</kbd> + <kbd>1</kbd> | Releases focus from Terminal or sidebar back to code. |

---

## ✍️ 2. Autocomplete & Supercomplete (Antigravity Tab)

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Accept Autocomplete Suggestion** | <kbd>Tab</kbd> | Accepts entire code block / edit prediction. |
| **Accept Suggestion Word-by-Word** | <kbd>Ctrl</kbd> + <kbd>→</kbd> / <kbd>Cmd</kbd> + <kbd>→</kbd> | Accepts next word of suggested code. |
| **Trigger Inline Suggestion Manually**| <kbd>Alt</kbd> + <kbd>\</kbd> | Forces a completion query at the current cursor position. |
| **Dismiss Suggestion** | <kbd>Escape</kbd> | Dismisses the current floating completion. |

---

## 🔍 3. Agent Diff & Hunk Review (In-Editor Diffs)

| Action | Shortcut | Internal Command ID |
| :--- | :--- | :--- |
| **Focus Next Edit Hunk** | <kbd>Alt</kbd> + <kbd>J</kbd> | `antigravity.prioritized.agentFocusNextHunk` |
| **Focus Previous Edit Hunk** | <kbd>Alt</kbd> + <kbd>K</kbd> | `antigravity.prioritized.agentFocusPreviousHunk` |
| **Accept Focused Hunk** | <kbd>Alt</kbd> + <kbd>Enter</kbd> | `antigravity.prioritized.agentAcceptFocusedHunk` |
| **Reject Focused Hunk** | <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Backspace</kbd> | `antigravity.prioritized.agentRejectFocusedHunk` |

---

## 📜 4. Command Palette Actions (`Ctrl + Shift + P` / `Cmd + Shift + P`)

| Title in Command Palette | Command Identifier | Description |
| :--- | :--- | :--- |
| **Agent: Focus on Agent View** | `antigravity.focusAgentView` | Opens and focuses the agent chat panel. |
| **Generate Commit Message** | `antigravity.generateCommitMessage` | Uses AI to generate a commit message from staged changes. |
| **Execute Code (Antigravity)** | `antigravity-code-executor.executeCode` | Runs code cells or scripts via the Antigravity engine. |
| **Log in to IDE** | `antigravity.login` | Authenticates user with Google / Antigravity account. |
| **Provide Auth Token (Backup Login)** | `antigravity.loginWithAuthToken` | Authenticates using a manual bearer token. |
| **Copy API Key to Clipboard** | `antigravity.copyApiKey` | Copies active API key for external SDKs/tools. |
| **Open Changelog** | `antigravity.openChangeLog` | Displays latest Antigravity release notes. |
| **Restart Language Server** | `antigravity.restartLanguageServer` | Restarts language intelligence engine. |
| **Kill Extension Host on Remote Server**| `antigravity.killRemoteExtensionHost` | Restarts remote development process. |
| **Import VS Code Settings** | `antigravity.importVSCodeSettings` | Imports keybindings and preferences from VS Code. |
| **Import Cursor Settings** | `antigravity.importCursorSettings` | Imports settings from Cursor IDE. |
| **Import Windsurf Settings** | `antigravity.importWindsurfSettings` | Imports settings from Windsurf IDE. |

---

## ⚡ 5. Slash Commands (In Chat Canvas)

| Slash Command | Usage / Purpose |
| :--- | :--- |
| **`/goal`** | Runs deep, multi-step long-running tasks without stopping until the objective is fully met. |
| **`/schedule`** | Schedules background jobs (cron) or one-shot delayed reminders. |
| **`/grill-me`** | Interactive planning interview to resolve ambiguous architectural decisions. |
| **`/learn`** | Teaches the agent a persistent rule, workflow, or behavior for future sessions. |

---

## 📎 6. `@` Context Mentions (In Chat Canvas)

| Mention Type | Syntax | Example | Description |
| :--- | :--- | :--- | :--- |
| **File / Folder** | `@<path>` | `@src/server.js` | Injects full source code of file into agent context. |
| **Terminal** | `@terminal` | `@terminal:1` | Injects active terminal output into agent prompt. |
| **Rules** | `@rule` | `@rule:atomic-commits` | Injects a specific custom rule. |
| **MCP Server** | `@mcp` | `@mcp:github` | Targets queries to Model Context Protocol server. |
| **Conversation** | `@chat` | `@chat:session-id` | References context from an earlier chat session. |

---

## 🖥️ 7. General Navigation & Terminal Controls

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Command Palette** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Global search for all IDE commands. |
| **Quick Open File** | <kbd>Ctrl</kbd> + <kbd>P</kbd> | Fuzzy-search and open workspace files. |
| **Toggle Terminal** | <kbd>Ctrl</kbd> + <kbd>J</kbd> / <kbd>Ctrl</kbd> + <kbd>`</kbd> | Opens or hides the integrated terminal pane. |
| **Toggle Sidebar** | <kbd>Ctrl</kbd> + <kbd>B</kbd> | Shows or hides the primary sidebar. |
| **Global File Search** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | Searches for text across the entire workspace. |
