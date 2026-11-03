@echo off
title Darts LMS WhatsApp sender
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  echo Install the "LTS" version, then double-click start.bat again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing, this takes about a minute...
  call npm install --no-audit --no-fund
)
:run
node sender.mjs
echo.
echo The sender stopped. Restarting in 10 seconds (close this window to stop it)...
timeout /t 10 >nul
goto run
