<<<<<<< HEAD
@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install LTS from https://nodejs.org
  pause
  exit /b 1
)

if not exist "data\users.json" (
  node scripts\init-data.js
)

echo Starting Smart Suite on http://127.0.0.1:8787/suite.html
node server.js
if errorlevel 1 (
  echo.
  echo If you see EADDRINUSE, port 8787 is busy.
  echo Run: netstat -ano ^| findstr :8787
  echo Then: taskkill /PID ^<pid^> /F
)
pause
=======
@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install LTS from https://nodejs.org
  pause
  exit /b 1
)

if not exist "data\users.json" (
  node scripts\init-data.js
)

echo Starting Smart Suite on http://127.0.0.1:8787/suite.html
node server.js
if errorlevel 1 (
  echo.
  echo If you see EADDRINUSE, port 8787 is busy.
  echo Run: netstat -ano ^| findstr :8787
  echo Then: taskkill /PID ^<pid^> /F
)
pause
>>>>>>> 11c8bba4e78e307c57b94b3c3a16ec91fe1d3509
