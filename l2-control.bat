@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ==========================
rem L2 CORE OS Control Center
rem ==========================

call :init_paths
if errorlevel 1 goto :fatal

if /i "%~1"=="--start" (call :action_start & exit /b %errorlevel%)
if /i "%~1"=="--stop" (call :action_stop & exit /b %errorlevel%)
if /i "%~1"=="--restart" (call :action_restart & exit /b %errorlevel%)
if /i "%~1"=="--status" (call :action_status & exit /b %errorlevel%)
if /i "%~1"=="--go" (call :action_gonogo & exit /b %errorlevel%)
if /i "%~1"=="--wa-recover" (call :action_wa_recover & exit /b %errorlevel%)
if /i "%~1"=="--open" (call :action_open_dashboard & exit /b %errorlevel%)
if /i "%~1"=="--recreate-env" (call :action_recreate_env & exit /b %errorlevel%)

:menu
cls
echo =========================================
echo L2 CORE OS - CONTROL CENTER (Windows)
echo Root: %PROJECT_ROOT%
echo =========================================
echo [1] Start seguro (up + health)
echo [2] Stop (down)
echo [3] Restart seguro
echo [4] Status consolidado
echo [5] Logs rapidos (api/gateway/db)
echo [6] GO/NO-GO
echo [7] WhatsApp recover (reconnect + catchup)
echo [8] Abrir dashboard web
echo [9] Recriar .env (self-heal)
echo [0] Sair
echo.
set "op="
set /p op=Escolha uma opcao (0-9) e pressione Enter: 
set "op=%op: =%"

if "%op%"=="1" call :action_start & goto :pause_menu
if "%op%"=="2" call :action_stop & goto :pause_menu
if "%op%"=="3" call :action_restart & goto :pause_menu
if "%op%"=="4" call :action_status & goto :pause_menu
if "%op%"=="5" call :action_logs & goto :pause_menu
if "%op%"=="6" call :action_gonogo & goto :pause_menu
if "%op%"=="7" call :action_wa_recover & goto :pause_menu
if "%op%"=="8" call :action_open_dashboard & goto :pause_menu
if "%op%"=="9" call :action_recreate_env & goto :pause_menu
if "%op%"=="0" goto :end

echo [WARN] Opcao invalida: %op%
timeout /t 1 /nobreak >nul
goto :menu

:pause_menu
echo.
pause
goto :menu

:init_paths
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "PROJECT_ROOT=%SCRIPT_DIR%"
if not exist "%PROJECT_ROOT%\infra\docker-compose.yml" set "PROJECT_ROOT=%SCRIPT_DIR%\.."
if not exist "%PROJECT_ROOT%\infra\docker-compose.yml" (
  echo [ERRO] Nao foi possivel localizar infra\docker-compose.yml
  echo [DICA] Execute este script na raiz do projeto L2 CORE OS.
  exit /b 1
)

for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
set "COMPOSE_FILE=%PROJECT_ROOT%\infra\docker-compose.yml"
set "ENV_FILE=%PROJECT_ROOT%\infra\.env"
set "ENV_EXAMPLE=%PROJECT_ROOT%\infra\.env.example"
set "E2E_SCRIPT=%PROJECT_ROOT%\infra\scripts\e2e-go-no-go.ps1"
set "UI_DIR=%PROJECT_ROOT%\apps\web-ui"

cd /d "%PROJECT_ROOT%"
exit /b 0

:docker_ready
docker version >nul 2>&1
if %errorlevel% EQU 0 exit /b 0

echo [INFO] Docker nao esta ativo. Tentando abrir Docker Desktop...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
  echo [ERRO] Docker Desktop nao encontrado.
  exit /b 1
)

set /a tries=0
:wait_docker
set /a tries+=1
timeout /t 3 /nobreak >nul
docker version >nul 2>&1
if %errorlevel% EQU 0 exit /b 0
if %tries% GEQ 40 (
  echo [ERRO] Docker nao ficou pronto a tempo.
  exit /b 1
)
goto :wait_docker

:ensure_env
if exist "%ENV_FILE%" exit /b 0

if exist "%ENV_EXAMPLE%" (
  copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
  echo [OK] %ENV_FILE% criado a partir de %ENV_EXAMPLE%
  exit /b 0
)

echo [WARN] %ENV_EXAMPLE% nao encontrado. Gerando env minimo seguro...
(
  echo APP_ENV=development
  echo APP_NAME=L2 Core OS
  echo TIMEZONE=America/Sao_Paulo
  echo JWT_SECRET=change_me_please
  echo JWT_ALGO=HS256
  echo WEB_PORT=3000
  echo API_PORT=8000
  echo BAILEYS_PORT=8090
  echo POSTGRES_PORT=5432
  echo REDIS_PORT=6379
  echo POSTGRES_DB=l2core
  echo POSTGRES_USER=l2
  echo POSTGRES_PASSWORD=l2core_local
  echo DATABASE_URL=postgresql://l2:l2core_local@db:5432/l2core
  echo REDIS_URL=redis://redis:6379/0
  echo WEBHOOK_HMAC_SECRET=change_this_secret
  echo WEBHOOK_REPLAY_WINDOW_SECONDS=300
  echo RATE_LIMIT_IP_PER_MIN=60
  echo RATE_LIMIT_TOKEN_PER_MIN=120
  echo BAILEYS_SESSION_NAME=main
  echo BAILEYS_INTERNAL_TOKEN=change_internal_token
  echo STARTUP_CATCHUP_HOURS=24
  echo AUTO_MARK_READ=false
  echo AUTO_REPLY_ONLY_SAFE_INTENTS=true
  echo HUMAN_REVIEW_DEFAULT=true
  echo WHATSAPP_NUMBER_MODE=primary
  echo AUTO_FINANCE_FROM_WHATSAPP=confirm_required
) > "%ENV_FILE%"

echo [OK] %ENV_FILE% gerado com defaults.
exit /b 0

:compose
set "CMD=%*"
docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" %CMD%
exit /b %errorlevel%

:wait_http
set "URL=%~1"
set "MAX_TRIES=%~2"
set "SLEEP_SEC=%~3"
if "%MAX_TRIES%"=="" set "MAX_TRIES=10"
if "%SLEEP_SEC%"=="" set "SLEEP_SEC=2"
set /a n=0
:wait_http_loop
set /a n+=1
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2) > $null; exit 0}catch{exit 1}"
if %errorlevel% EQU 0 exit /b 0
if %n% GEQ %MAX_TRIES% exit /b 1
timeout /t %SLEEP_SEC% /nobreak >nul
goto :wait_http_loop

:action_start
call :docker_ready || exit /b 1
call :ensure_env || exit /b 1
call :compose up -d || exit /b 1
call :wait_http "http://localhost:8000/health" 15 2
if errorlevel 1 (
  echo [WARN] API ainda inicializando.
) else (
  echo [OK] API respondeu health.
)
exit /b 0

:action_stop
call :docker_ready || exit /b 1
call :compose down
echo [OK] Stack parada.
exit /b 0

:action_restart
call :docker_ready || exit /b 1
call :ensure_env || exit /b 1
call :compose down
call :compose up -d
echo [OK] Restart concluido.
exit /b 0

:action_status
call :docker_ready || exit /b 1
echo --- Docker compose ps ---
call :compose ps
echo.
echo --- API health ---
call :wait_http "http://localhost:8000/health" 12 2
if errorlevel 1 (
  echo [WARN] API ainda inicializando ou indisponivel.
) else (
  powershell -NoProfile -Command "Invoke-RestMethod 'http://localhost:8000/health' | ConvertTo-Json -Depth 4"
)
echo.
echo --- WhatsApp status ---
call :wait_http "http://localhost:8090/session/status" 12 2
if errorlevel 1 (
  echo [WARN] WhatsApp gateway ainda inicializando ou indisponivel.
) else (
  powershell -NoProfile -Command "Invoke-RestMethod 'http://localhost:8090/session/status' | ConvertTo-Json -Depth 8"
)
exit /b 0

:action_logs
call :docker_ready || exit /b 1
echo [1] API  [2] Gateway  [3] DB
set "lg="
set /p lg=Servico: 
if "%lg%"=="1" call :compose logs api --tail 120
if "%lg%"=="2" call :compose logs baileys-gateway --tail 120
if "%lg%"=="3" call :compose logs db --tail 120
exit /b 0

:action_gonogo
call :ensure_env || exit /b 1
if not exist "%E2E_SCRIPT%" (
  echo [ERRO] Script GO/NO-GO nao encontrado: %E2E_SCRIPT%
  exit /b 1
)
powershell -ExecutionPolicy Bypass -File "%E2E_SCRIPT%"
exit /b %errorlevel%

:action_wa_recover
powershell -NoProfile -Command "try{Invoke-RestMethod -Method Post 'http://localhost:8090/session/connect' | Out-Null}catch{}; Start-Sleep -Seconds 2; try{Invoke-RestMethod -Method Post 'http://localhost:8090/session/catchup' | ConvertTo-Json -Depth 8}catch{$_|Out-String}"
exit /b 0

:action_open_dashboard
echo [INFO] Abrindo dashboard principal...

call :wait_http "http://localhost:8080" 2 1
if %errorlevel% EQU 0 (
  start http://localhost:8080
  exit /b 0
)

if exist "%UI_DIR%\package.json" (
  echo [INFO] Iniciando UI principal em http://localhost:8080 ...
  start "L2 UI (web-ui)" cmd /k "cd /d "%UI_DIR%" && npm run dev"
  timeout /t 4 /nobreak >nul
  start http://localhost:8080
  exit /b 0
)

echo [WARN] UI principal nao encontrada. Abrindo painel tecnico em http://localhost:3000
start http://localhost:3000
exit /b 0

:action_recreate_env
if exist "%ENV_FILE%" del /f /q "%ENV_FILE%" >nul 2>&1
call :ensure_env
exit /b %errorlevel%

:fatal
echo [FATAL] Falha ao inicializar control center.
pause
exit /b 1

:end
echo Encerrado.
endlocal
exit /b 0
