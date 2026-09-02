<div align="center">

  <img src="assets/banner.png" alt="Pocket Antigravity Banner" width="100%" style="border-radius: 8px;" />

  <br/><br/>

  <img src="assets/logo.png" alt="Pocket Antigravity Logo" width="120" height="120" style="border-radius: 50%; box-shadow: 0 4px 20px rgba(92, 45, 145, 0.4);" />

  # ✨ Pocket Antigravity IDE

  **Control, prompt, and monitor your desktop Antigravity IDE remotely from your mobile phone with real-time streaming and zero plugins.**

  <p align="center">
    <a href="#-features"><img src="https://img.shields.io/badge/Platform-Windows%20Win32-0078D6?style=flat-square&logo=windows" alt="Windows"></a>
    <a href="#-features"><img src="https://img.shields.io/badge/Interface-Mobile%20Web%20App-007acc?style=flat-square&logo=visualstudiocode" alt="VS Code UI"></a>
    <a href="#-features"><img src="https://img.shields.io/badge/Tunnel-Cloudflare%20%2F%20Localtunnel-F38020?style=flat-square&logo=cloudflare" alt="Cloudflare"></a>
    <a href="#-features"><img src="https://img.shields.io/badge/Real--Time-WebSockets%20%26%20JSONL-10b981?style=flat-square" alt="Real-Time"></a>
    <a href="#-license"><img src="https://img.shields.io/badge/License-MIT-purple?style=flat-square" alt="License"></a>
  </p>

</div>

---

## 🎨 Features at a Glance

- **📱 Remote Text & Multimedia Prompts**: Send text prompts, camera photos, and workspace file references from your phone straight into Antigravity IDE.
- **⚡ Zero Plugin Installation**: Works out of the box using native Windows Win32 P/Invoke OS-level window handles & keyboard drivers.
- **➕ 1-Tap New Chat Creation**: Create fresh conversation sessions instantly directly from your phone (`➕ New Chat`).
- **📁 Workspace File Explorer**: Browse your project files, view source code with syntax highlighting, and attach files with 1 tap (`@path/to/file`).
- **💬 Real-Time Streaming**: Live WebSockets output stream reading `.jsonl` brain transcripts directly from disk.
- **🌐 Global Access Tunnel**: Built-in Cloudflare & Localtunnel launcher for instant encrypted HTTPS access anywhere in the world over 4G/5G/Wi-Fi.
- **✨ VS Code Dark+ Theme**: Native VS Code Dark+ styling (`Inter` & `Fira Code`), complete Markdown rendering, light/dark theme toggle, and 1-tap **Copy Code** buttons.
- **🔒 PIN Security Lockscreen**: Built-in 4-digit PIN authentication (`pocket.config.json`) protecting your remote tunnel from unauthorized access.
- **⚡ [Complete Antigravity Shortcuts Guide](ANTIGRAVITY_SHORTCUTS.md)**: Full cheatsheet of native keybindings, diff review controls, slash commands, and Command Palette actions.

---

## 🛠️ Deep Technical Architecture

Pocket Antigravity uses OS-level desktop automation and IPC patterns to interface with Antigravity IDE (Electron/Chromium architecture) without requiring external IDE extensions.

```mermaid
flowchart TD
    Phone[📱 Phone / Mobile Web App] -->|HTTP POST / WebSockets| Server[Node.js Host Server :3000]
    Tunnel[Cloudflare / Localtunnel] -.->|HTTPS Public URL| Phone
    
    subgraph Windows OS Automation
        Server -->|1. Focus Release| FocusRel[Ctrl+1 / Focus First Editor Group]
        Server -->|2. Win32 Window Restore| WinFinder[Win32 P/Invoke & AttachThreadInput]
        Server -->|3. Activate Agent View| CmdPalette[Command Palette: Agent: Focus on Agent View]
        Server -->|4. Input Focus Lock| InputLock[Ctrl+L Input Lock]
        Server -->|5. Clipboard & Key Injection| KeySim[Win32 keybd_event - Ctrl+V & Enter]
        WinFinder --> AntigravityIDE[Antigravity IDE Window]
        CmdPalette --> AntigravityIDE
        InputLock --> AntigravityIDE
        KeySim --> AntigravityIDE
    end

    subgraph UI State Detection & Transcript Tailing
        Server -->|UIAutomation 2-Pass Scan| StateDetector[check-chat-state.ps1]
        AntigravityIDE -->|Appends JSONL steps| TranscriptLogs[AppData Brain Transcripts]
        Watcher[Transcript Log Watcher] -->|Chokidar tailing| TranscriptLogs
        Watcher -->|WebSocket Push| Server
    end
```

### 1. Win32 Window Restoration & Focus (`Win32ClipboardInjector`)
- **Process & Window Handle Resolution**: Uses `EnumWindows` and `GetClassName` to target the top-level Electron window with window class `Chrome_WidgetWin_1` and process matching `Antigravity`.
- **Z-Order Restoration**: Performs 3-way thread input attachment via `AttachThreadInput(currentThread, targetThread, true)` combined with `OpenIcon(hwnd)` and `SetWindowPos(HWND_TOPMOST)` to reliably bring the IDE window to the foreground across OS focus restrictions.

### 2. Focus Sequence Strategy
To handle focus regardless of whether the user is typing in a code file, interacting with the terminal (`Ctrl+J`), or has the chat panel open/closed:

1. **`Ctrl + 1` (Editor Focus Release)**: Safely releases focus from the Terminal (`xterm.js`), Output panels, or active widgets into the main editor group without opening/closing panels.
2. **Command Palette Activation (`Ctrl+Shift+P` ➔ `"Agent: Focus on Agent View"`)**: Natively opens and activates the Agent View sidebar.
3. **Input Focus Lock (`Ctrl + L`)**: Locks the blinking cursor directly into the prompt text input box.
4. **Deliberate Timing Delay (`focusDelayMs = 500ms`)**: Ensures UI animations complete before injecting text.
5. **Clipboard Paste & Submit (`Ctrl + V` + `Enter`)**: Pastes the prompt text from an STA thread clipboard worker and triggers the enter keystroke.

### 3. UI State Detection (`check-chat-state.ps1`)
- **2-Pass Chromium UIA Activation**: Chromium renderer accessibility trees are dormant by default. The detector issues a 1st-pass query (`FindFirst`) to wake up the accessibility tree, followed by a 2nd-pass query (`FindAll(ControlType.Edit)`) to read active controls.
- **Filter Rules**: Excludes ActivityBar icons, Terminal controls (`xterm`), and Monaco editor code files (`.js`, `.html`, `.css`, etc.) to provide calibrated `FOCUSED`, `OPENED`, and `CLOSED` states.
- **Output Sanitization**: Strips raw control characters and line breaks (`\r\n\t`) from window titles before emitting JSON to guarantee safe parsing.

---

## 🗺️ Roadmap & Upcoming Features (Issues Backlog)

### 📌 Issue 1: Remote Code Diff Review & "Accept All / Reject All" Actions
- **Goal**: Allow mobile users to review modified files and accept or reject code changes generated by the Antigravity Agent directly from their phone.
- **Key Deliverables**:
  - `GET /api/changes`: Endpoint streaming working tree changes / git diffs (`git diff --stat`).
  - Mobile Diff Viewer: Visual comparison showing additions and deletions in modified files.
  - Remote Actions: `[✅ Accept All]` (invokes IDE accept command/shortcut) & `[❌ Reject All]` (discards unstaged changes via `git restore`).

### 📌 Issue 2: Multi-Assistant & Custom Agent Persona Management
- **Goal**: Enable switching between specialized assistant personas (e.g., Code Reviewer, Architect, Debugger) and configuring custom system instructions from the phone.
- **Key Deliverables**:
  - Assistant Persona Selector in the top navigation bar.
  - Persona Prompt Injector: Automatically prepending context/rules to user prompts.
  - Custom Skills Trigger: Mobile browser interface to explore and execute Antigravity custom skills and tools remotely.

---

## 🚀 Quick Start Guide

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/IvanCR48/Pocket-AntiGravityIDE.git
cd Pocket-AntiGravityIDE
npm install
```

### 2. Launch (1-Click)
Double click **`start.bat`** (or run `npm run app` in your terminal).

This will launch:
1. **Pocket Antigravity Server** on `http://localhost:3000`.
2. **Global Access Tunnel** which generates your public HTTPS link and QR code for your phone.

### 3. Stop
Double click **`stop.bat`** (or run `npm run stop`).

---

## 📄 License

MIT License - feel free to use, modify, and extend!
