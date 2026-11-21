@echo off
setlocal
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"
set "BACKEND_PY=%~dp0backend\.venv\Scripts\python.exe"

if not exist "%BACKEND_PY%" (
  echo [ERROR] Python virtual environment not found: %BACKEND_PY%
  echo Please complete backend setup first.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd not found. Ensure Node.js is installed in C:\Program Files\nodejs.
  pause
  exit /b 1
)

if not exist "%~dp0frontend\node_modules" (
  echo [INFO] Installing frontend packages...
  pushd "%~dp0frontend"
  call npm.cmd install
  popd
)

echo Starting Backend API on port 8000...
start "FlexAdmin Backend (8000)" cmd /k "cd /d "%~dp0backend" && "%BACKEND_PY%" -m uvicorn app.main:app --reload --port 8000"

echo Starting Frontend Dev Server on port 5173...
start "FlexAdmin Frontend (5173)" cmd /k "cd /d "%~dp0frontend" && set "PATH=C:\Program Files\nodejs;%PATH%" && npm.cmd run dev"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Servers launched in separate windows.
echo Close both server windows when you want to stop them.
