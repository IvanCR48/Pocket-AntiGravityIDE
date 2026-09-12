@echo off
chcp 65001 >nul
title Pocket Antigravity — Shutdown
cd /d "%~dp0.."

setlocal enabledelayedexpansion
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

echo.
echo %ESC%[38;2;242;63;67m╭──────────────────────────────────────────────────────────╮%ESC%[0m
echo %ESC%[38;2;242;63;67m│%ESC%[0m  %ESC%[1;31m🛑 STOPPING POCKET ANTIGRAVITY SERVICES...%ESC%[0m              %ESC%[38;2;242;63;67m│%ESC%[0m
echo %ESC%[38;2;242;63;67m╰──────────────────────────────────────────────────────────╯%ESC%[0m
echo.

:: 1. Safely terminate only the process listening on Pocket Antigravity port (default 3000)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo %ESC%[38;2;255;204;0m[*]%ESC%[0m Closing host listener on PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Terminate the launched terminal host windows
taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Tunnel*" >nul 2>&1

echo.
echo %ESC%[38;2;0;255;136m╭──────────────────────────────────────────────────────────╮%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m  %ESC%[1;32m✔ Server and Tunnel stopped cleanly!%ESC%[0m                    %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m│%ESC%[0m  %ESC%[90m(No other background Node.js processes were affected)%ESC%[0m   %ESC%[38;2;0;255;136m│%ESC%[0m
echo %ESC%[38;2;0;255;136m╰──────────────────────────────────────────────────────────╯%ESC%[0m
echo.
pause
