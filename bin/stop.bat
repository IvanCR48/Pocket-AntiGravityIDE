@echo off
title Stop Pocket Antigravity
cd /d "%~dp0.."

echo ==================================================
echo 🛑 Stopping Pocket Antigravity Server and Tunnel...
echo ==================================================

:: 1. Safely terminate only the process listening on Pocket Antigravity port (default 3000)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Terminate the launched terminal host windows
taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Tunnel*" >nul 2>&1

echo.
echo ✅ Pocket Antigravity Server and Tunnel stopped successfully!
echo (No other background Node.js processes were affected)
echo ==================================================
pause
