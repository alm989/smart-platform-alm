@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js نصب نیست. از https://nodejs.org نسخه LTS را نصب کنید.
  pause
  exit /b 1
)

if not exist "data\users.json" (
  node scripts\init-data.js
)

echo در حال اجرا روی http://127.0.0.1:8787/suite.html
node server.js
pause
