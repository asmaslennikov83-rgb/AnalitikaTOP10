@echo off
cd /d "%~dp0"
if exist ".env" (
  node --env-file=".env" index.js
) else (
  node index.js
)
if errorlevel 1 pause
