@echo off
title Pocket Antigravity — Host Control Center
cd /d "%~dp0.."

echo ==================================================
echo 🎛️  Launching Pocket Antigravity Host Control Center...
echo ==================================================

:: Check if server is running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [Host] Starting Pocket Antigravity Server in background...
    start "Pocket Antigravity Server" /min cmd /c "node src/server.js"
    timeout /t 2 /nobreak >nul
) else (
    echo [Host] Pocket Antigravity Server is already active on port 3000.
)

:: Launch in native windowed App Mode (Discord / VirtualBox style)
set "APP_URL=http://localhost:3000/dashboard"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%"
    exit /b 0
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%"
    exit /b 0
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
    exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
    exit /b 0
)

:: Fallback: Open default browser
start "" "%APP_URL%"
exit /b 0
