@echo off
chcp 65001 > nul
title F1 Telemetry Analytics — Dev Launcher

echo.
echo  ================================================
echo   F1 Telemetry Analytics  Dev Launcher
echo  ================================================
echo.

:: ── 1. Docker MySQL 시작 ─────────────────────────
echo [1/3] Docker MySQL 시작 중...
docker compose up -d
if %errorlevel% neq 0 (
    echo.
    echo  [오류] Docker가 실행되지 않았습니다.
    echo  Docker Desktop을 먼저 실행한 뒤 다시 시도하세요.
    pause
    exit /b 1
)
echo       완료
echo.

:: ── 2. 백엔드 (FastAPI) ──────────────────────────
echo [2/3] FastAPI 백엔드 실행 중...
start "F1 Backend — port 8000" cmd /k ^
  "cd /d %~dp0backend && call venv\Scripts\activate && echo. && echo  Backend running → http://localhost:8000/docs && echo. && uvicorn app.main:app --reload --port 8000"
echo       완료 (새 창 확인)
echo.

:: ── 3. 프론트엔드 (Vite) ─────────────────────────
echo [3/3] React 프론트엔드 실행 중...
start "F1 Frontend — port 5173" cmd /k ^
  "cd /d %~dp0frontend && echo. && echo  Frontend running → http://localhost:5173 && echo  Network access → http://[YOUR_IP]:5173 && echo. && npm run dev -- --host"
echo       완료 (새 창 확인)
echo.

:: ── 잠깐 대기 후 브라우저 열기 ──────────────────
echo  잠시 후 브라우저를 자동으로 엽니다...
timeout /t 4 /nobreak > nul
start http://localhost:5173

echo.
echo  ================================================
echo   실행 완료!
echo.
echo   대시보드    : http://localhost:5173
echo   API Swagger : http://localhost:8000/docs
echo.
echo   네트워크 접속 IP 확인 방법:
echo   → 이 창에서  ipconfig  입력 후
echo     IPv4 주소 (예: 192.168.x.x) 확인
echo.
echo   종료하려면: 백엔드/프론트엔드 창에서 Ctrl+C
echo   MySQL:      docker compose stop
echo  ================================================
echo.
ipconfig | findstr "IPv4"
echo.
pause
