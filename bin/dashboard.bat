@echo off
chcp 65001 >nul
title Pocket Antigravity — Host Control Center
cd /d "%~dp0.."

setlocal enabledelayedexpansion
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

echo.
echo %ESC%[38;2;88;101;242m╭──────────────────────────────────────────────────────────╮%ESC%[0m
echo %ESC%[38;2;88;101;242m│%ESC%[0m  %ESC%[1;37m🎛️  POCKET ANTIGRAVITY — HOST CONTROL CENTER%ESC%[0m            %ESC%[38;2;88;101;242m│%ESC%[0m
echo %ESC%[38;2;88;101;242m│%ESC%[0m  %ESC%[38;2;0;240;255mStarting Standalone Desktop Hub in Windowed Mode...%ESC%[0m     %ESC%[38;2;88;101;242m│%ESC%[0m
echo %ESC%[38;2;88;101;242m╰──────────────────────────────────────────────────────────╯%ESC%[0m
echo.

:: Check if server is running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo %ESC%[38;2;255;204;0m[*]%ESC%[0m Starting background server host on port 3000...
    start "Pocket Antigravity Server" /min cmd /c "node src/server.js"
    timeout /t 2 /nobreak >nul
) else (
    echo %ESC%[38;2;0;255;136m[✔]%ESC%[0m Pocket Antigravity Host is active on port 3000.
)

:: Launch in native windowed App Mode (Discord / VirtualBox style)
set "APP_URL=http://localhost:3000/dashboard"

echo %ESC%[38;2;0;240;255m[*]%ESC%[0m Launching frameless desktop dashboard...

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
