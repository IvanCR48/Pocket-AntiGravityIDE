@echo off
chcp 65001 >nul
title Pocket Antigravity — Launcher
cd /d "%~dp0.."

setlocal enabledelayedexpansion
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

echo.
echo %ESC%[38;2;88;101;242m╭──────────────────────────────────────────────────────────╮%ESC%[0m
echo %ESC%[38;2;88;101;242m│%ESC%[0m  %ESC%[1;37m🚀 POCKET ANTIGRAVITY — HOST LAUNCHER%ESC%[0m                   %ESC%[38;2;88;101;242m│%ESC%[0m
echo %ESC%[38;2;88;101;242m│%ESC%[0m  %ESC%[38;2;0;240;255mStarting Hexagonal Server ^& Encrypted Tunnel...%ESC%[0m         %ESC%[38;2;88;101;242m│%ESC%[0m
echo %ESC%[38;2;88;101;242m╰──────────────────────────────────────────────────────────╯%ESC%[0m
echo.

:: 1. Start Node Server in new styled terminal window
echo %ESC%[38;2;0;255;136m[1/2]%ESC%[0m Launching Pocket Antigravity Server...
start "Pocket Antigravity Server" cmd /k "chcp 65001 >nul && title Pocket Antigravity Server && node src/server.js"

:: Wait 2 seconds for server port initialization
timeout /t 2 /nobreak >nul

:: 2. Start Global Access Tunnel in new styled terminal window
echo %ESC%[38;2;0;255;136m[2/2]%ESC%[0m Launching Global Access Tunnel...
start "Pocket Antigravity Tunnel" cmd /k "chcp 65001 >nul && title Pocket Antigravity Tunnel && node bin/start-tunnel.js"

echo.
echo %ESC%[38;2;0;255;136m╭──────────────────────────────────────────────────────────╮%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m  %ESC%[1;32m✔ Pocket Antigravity is up and running!%ESC%[0m                 %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m                                                          %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m  1. %ESC%[1mServer Window:%ESC%[0m http://localhost:3000                 %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m  2. %ESC%[1mDashboard:%ESC%[0m     http://localhost:3000/dashboard       %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m  3. %ESC%[1mTunnel Window:%ESC%[0m Scanning phone QR code...              %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m╰──────────────────────────────────────────────────────────╯%ESC%[0m
echo.
echo %ESC%[90mPress any key to close this launcher window (Server and Tunnel will stay running).%ESC%[0m
pause >nul
