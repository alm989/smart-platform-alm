@echo off
chcp 65001 >nul
cd /d "%~dp0"

set SRC=%~dp0..
if not exist "%SRC%\suite.html" if exist "D:\smart-platform-alm\suite.html" set SRC=D:\smart-platform-alm

echo Source: %SRC%
echo Target: %~dp0public

if not exist "public" mkdir public

copy /Y "%SRC%\*.html" "public\" >nul
copy /Y "%SRC%\core.js" "public\" >nul
if exist "%SRC%\suite-facilities.js" copy /Y "%SRC%\suite-facilities.js" "public\" >nul
if exist "%SRC%\facilities-autoload.js" copy /Y "%SRC%\facilities-autoload.js" "public\" >nul
if exist "%SRC%\module-kit.css" copy /Y "%SRC%\module-kit.css" "public\" >nul
if exist "%SRC%\module-kit.js" copy /Y "%SRC%\module-kit.js" "public\" >nul

echo Done. Files in public:
dir /b public\*.html | find /c /v ""
pause
