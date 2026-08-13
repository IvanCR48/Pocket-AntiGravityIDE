@echo off
title Stop Pocket Antigravity
cd /d "%~dp0"

echo ==================================================
echo 🛑 Stopping Pocket Antigravity Server & Tunnel...
echo ==================================================

taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Pocket Antigravity Tunnel*" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo.
echo ✅ Server and Tunnel stopped successfully!
echo ==================================================
pause
