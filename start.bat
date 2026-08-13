@echo off
title Launch Pocket Antigravity
cd /d "%~dp0"

echo ==================================================
echo 🚀 Starting Pocket Antigravity Host & Tunnel...
echo ==================================================
echo.

:: 1. Start Node Server in new terminal window
start "Pocket Antigravity Server" cmd /k "title Pocket Antigravity Server && node src/server.js"

:: Wait 2 seconds for server port initialization
timeout /t 2 /nobreak >nul

:: 2. Start Global Access Tunnel in new terminal window
start "Pocket Antigravity Tunnel" cmd /k "title Pocket Antigravity Tunnel && node scripts/start-tunnel.js"

echo ==================================================
echo ✅ Pocket Antigravity is up and running!
echo ==================================================
echo 1. The Server window is running on http://localhost:3000
echo 2. The Tunnel window will display your phone link & QR code.
echo.
echo Press any key to close this launcher window (Server & Tunnel will stay running).
pause >nul
