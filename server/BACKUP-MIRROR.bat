@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Mirroring backups to backupExtraDir ...
node scripts\mirror-backups.js
echo.
pause
