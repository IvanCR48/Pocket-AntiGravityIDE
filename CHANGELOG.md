# 📦 Changelog

All notable changes to **Pocket Antigravity IDE** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-09-02

### 🏛️ Hexagonal & Clean Architecture Refactoring
- **Core Domain Entities (`src/core/domain/`)**: Pure business models (`Prompt`, `Session`, `FileDiff`, `WorkspaceChanges`) independent of frameworks or OS.
- **Application Use Cases (`src/core/usecases/`)**: Decoupled orchestrators (`SendPromptUseCase`, `ReviewChangesUseCase`, `ManageSessionsUseCase`).
- **Port Contracts (`src/core/ports/`)**: Clean interfaces for `IdeAutomationPort`, `VcsPort`, and `TranscriptPort`.
- **Secondary Infrastructure Adapters (`src/infrastructure/`)**:
  - `Win32AutomationAdapter`: OS window management and P/Invoke keyboard synthesis.
  - `GitAdapter`: Native Git CLI working tree inspection, staging, and rollback.
  - `JsonlTranscriptAdapter`: Incremental `.jsonl` brain log tailing and session discovery.
- **Primary Interface Adapters (`src/interfaces/`)**:
  - Modular Express routes (`auth.routes.js`, `changes.routes.js`, `sessions.routes.js`, `workspace.routes.js`, `prompt.routes.js`).
  - `WebSocketServerHandler`: Reactive streaming adapter.
- **Composition Root (`src/server.js`)**: Pure dependency injection container and application bootstrap.

---

## [1.2.0] - 2026-09-02

### ⚡ Remote Code Diff Review & Actions
- **Git Diff Engine (`src/workspace/diff.js`)**: Real-time git status, unified diffs parsing, and working tree statistics.
- **Mobile Diff Viewer Modal**: Line-by-line colored diffs with red/green syntax highlighting and changed file selector tabs.
- **Floating Changes Action Banner**: Non-intrusive floating card docked above the mobile input area that auto-detects modified files.
- **One-Tap Actions**:
  - `[Accept All]`: Injects native `Alt+Enter` in Antigravity IDE via Win32 P/Invoke and stages changes with `git add .`.
  - `[Reject All]`: Discards all unstaged changes and deletes untracked files via `git restore .` and `git clean -fd`.

---

## [1.1.0] - 2026-09-02

### 🔒 Security & Privacy
- **PIN Security Lockscreen**: Added 4-digit PIN authentication overlay (`pocket.config.json`) protecting public tunnels (Cloudflare/Localtunnel) against unauthorized access.
- **HMAC Session Tokens**: Cryptographic token generation and verification for REST API endpoints and WebSockets stream.
- **Manual Lock**: Added 1-tap lock button (`🔒`) in header status bar to clear local sessions.

---

## [1.0.0] - 2026-08-22

### 🚀 Initial Public Release

#### ✨ Core Features
- **Zero-Plugin Remote Control**: Direct Win32 P/Invoke OS-level window management (`AttachThreadInput`, `EnumWindows`, `SetForegroundWindow`) to focus and inject prompts into Antigravity IDE without external IDE extensions.
- **Calibrated Multi-Step Focus Sequence**: Automatic focus release from Terminal (`xterm.js`) or Monaco editors (`Ctrl + 1`), activation of Agent sidebar via Command Palette (`Agent: Focus on Agent View`), and prompt input focus lock (`Ctrl + L`).
- **Real-Time Live Streaming**: WebSockets server pushing live `.jsonl` brain transcripts directly to connected mobile clients.
- **Mobile-First VS Code Dark+ Design System**:
  - Full VS Code Dark+ color tokens (`#1e1e1e`, `#252526`, `#007acc`, `#4ec9b0`).
  - Google Fonts (`Inter` and `Fira Code`).
  - GitHub-Flavored Markdown rendering with syntax-colored code blocks and 1-tap **Copy** buttons.
  - Dark / Light theme toggle with `localStorage` persistence.
- **Workspace File Explorer**:
  - Recursive project directory scanner and file viewer with language syntax detection.
  - 1-tap file attachment to prompt (`@path/to/file`).
- **1-Tap New Chat**:
  - Native shortcut execution (`Ctrl + Shift + L`) with auto-session detection (`SESSION_AUTO_SWITCHED`) to prevent UI jumping.
- **Global Access Tunnel Launcher**:
  - Integrated Cloudflare & Localtunnel wrapper generating public encrypted HTTPS URLs and terminal QR codes for mobile devices over 4G/5G/Wi-Fi.
- **1-Click Launchers**:
  - `start.bat` and `stop.bat` scripts for seamless desktop execution.

---

## 🗺️ Upcoming Features (v1.1.0 Roadmap)
- Remote Code Diff Review with `[Accept All]` and `[Reject All]` action buttons.
- Multi-Assistant and custom agent persona switcher.
- Optional PIN / Passcode authentication for public tunnel endpoints.
