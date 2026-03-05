@echo off
setlocal EnableExtensions EnableDelayedExpansion

set NON_INTERACTIVE=0
if not "%~1"=="" set NON_INTERACTIVE=1

call :detect_paths
if errorlevel 1 goto fatal

if /i "%~1"=="--start" goto start_safe
if /i "%~1"=="--stop" goto stop
if /i "%~1"=="--restart" goto restart_safe
if /i "%~1"=="--status" goto status
if /i "%~1"=="--go" goto go_nogo
if /i "%~1"=="--wa-recover" goto wa_recover
if /i "%~1"=="--recreate-env" goto recreate_env

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
set /p op=Escolha uma opcao: 

if "%op%"=="1" goto start_safe
if "%op%"=="2" goto stop
if "%op%"=="3" goto restart_safe
if "%op%"=="4" goto status
if "%op%"=="5" goto logs
if "%op%"=="6" goto go_nogo
if "%op%"=="7" goto wa_recover
if "%op%"=="8" goto open_web
if "%op%"=="9" goto recreate_env
if "%op%"=="0" goto end
goto menu

:start_safe
call :check_docker
if errorlevel 1 goto menu
call :ensure_env
if errorlevel 1 goto menu

call :compose up -d
if errorlevel 1 (
  echo [ERRO] Falha ao subir stack. Tentando auto-recuperacao...
  call :ensure_env
  call :compose up -d
)
if errorlevel 1 (
  echo [ERRO] Falha persistente ao subir stack.
  echo [DIAG] docker compose ps:
  call :compose ps
  call :maybe_pause
  goto menu
)

timeout /t 6 /nobreak >nul
powershell -NoProfile -Command "try{(Invoke-RestMethod 'http://localhost:8000/health').ok}catch{$false}" >nul
if errorlevel 1 (
  echo [AVISO] API ainda inicializando.
) else (
  echo [OK] Stack iniciada com sucesso.
)
call :maybe_pause
goto menu

:stop
call :check_docker
if errorlevel 1 goto menu
call :compose down
echo [OK] Stack parada.
call :maybe_pause
goto menu

:restart_safe
call :check_docker
if errorlevel 1 goto menu
call :ensure_env
if errorlevel 1 goto menu
call :compose down
call :compose up -d
timeout /t 6 /nobreak >nul
echo [OK] Restart concluido.
call :maybe_pause
goto menu

:status
call :check_docker
if errorlevel 1 goto menu
echo --- Docker compose ps ---
call :compose ps
echo.
echo --- API health ---
powershell -NoProfile -Command "try{Invoke-RestMethod 'http://localhost:8000/health' | ConvertTo-Json -Depth 4}catch{$_|Out-String}"
echo.
echo --- WhatsApp status ---
powershell -NoProfile -Command "try{Invoke-RestMethod 'http://localhost:8090/session/status' | ConvertTo-Json -Depth 8}catch{$_|Out-String}"
call :maybe_pause
goto menu

:logs
call :check_docker
if errorlevel 1 goto menu
echo [1] API  [2] Gateway  [3] DB
set /p lg=Servico: 
if "%lg%"=="1" call :compose logs api --tail 120
if "%lg%"=="2" call :compose logs baileys-gateway --tail 120
if "%lg%"=="3" call :compose logs db --tail 120
call :maybe_pause
goto menu

:go_nogo
call :ensure_env
if errorlevel 1 goto menu
powershell -ExecutionPolicy Bypass -File "%E2E_SCRIPT%"
call :maybe_pause
goto menu

:wa_recover
powershell -NoProfile -Command "try{Invoke-RestMethod -Method Post 'http://localhost:8090/session/connect' | Out-Null}catch{}; Start-Sleep -Seconds 2; try{Invoke-RestMethod -Method Post 'http://localhost:8090/session/catchup' | ConvertTo-Json -Depth 8}catch{$_|Out-String}"
call :maybe_pause
goto menu

:open_web
echo [INFO] Abrindo dashboard principal (Lovable UI)...
set UI_DIR=%PROJECT_ROOT%\apps\web-ui

rem 1) Se UI moderna ja estiver rodando (vite 8080), abre direto.
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing 'http://localhost:8080' -TimeoutSec 2) > $null; exit 0}catch{exit 1}"
if %errorlevel% EQU 0 (
  start http://localhost:8080
  goto menu
)

rem 2) Se existe projeto UI, tenta iniciar Vite em nova janela.
if exist "%UI_DIR%\package.json" (
  echo [INFO] Iniciando UI moderna em http://localhost:8080 ...
  start "L2 UI (Lovable)" cmd /k "cd /d "%UI_DIR%" && npm run dev"
  timeout /t 4 /nobreak >nul
  start http://localhost:8080
  goto menu
)

rem 3) Fallback para painel operacional tecnico.
echo [WARN] UI Lovable nao encontrada. Abrindo painel tecnico em http://localhost:3000
start http://localhost:3000
goto menu

:recreate_env
if exist "%ENV_FILE%" del /f /q "%ENV_FILE%" >nul 2>&1
call :ensure_env
call :maybe_pause
goto menu

:compose
set CMD=%*
docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" %CMD%
exit /b %errorlevel%

:check_docker
docker version >nul 2>&1
if %errorlevel% EQU 0 exit /b 0

echo [INFO] Docker nao esta ativo. Tentando abrir Docker Desktop...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
  echo [ERRO] Docker Desktop nao encontrado.
  call :maybe_pause
  exit /b 1
)

set /a tries=0
:docker_wait
set /a tries+=1
timeout /t 3 /nobreak >nul
docker version >nul 2>&1
if %errorlevel% EQU 0 exit /b 0
if %tries% GEQ 40 (
  echo [ERRO] Docker nao ficou pronto a tempo.
  call :maybe_pause
  exit /b 1
)
goto docker_wait

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
) > "%ENV_FILE%"

echo [OK] %ENV_FILE% gerado com defaults.
exit /b 0

:detect_paths
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

set PROJECT_ROOT=%SCRIPT_DIR%
if not exist "%PROJECT_ROOT%\infra\docker-compose.yml" (
  set PROJECT_ROOT=%SCRIPT_DIR%\..
)
if not exist "%PROJECT_ROOT%\infra\docker-compose.yml" (
  echo [ERRO] Nao foi possivel localizar infra\docker-compose.yml
  echo [DICA] Execute este script na raiz do projeto L2 CORE OS.
  call :maybe_pause
  exit /b 1
)

for %%I in ("%PROJECT_ROOT%") do set PROJECT_ROOT=%%~fI
set COMPOSE_FILE=%PROJECT_ROOT%\infra\docker-compose.yml
set ENV_FILE=%PROJECT_ROOT%\infra\.env
set ENV_EXAMPLE=%PROJECT_ROOT%\infra\.env.example
set E2E_SCRIPT=%PROJECT_ROOT%\infra\scripts\e2e-go-no-go.ps1
cd /d "%PROJECT_ROOT%"
exit /b 0

:maybe_pause
if "%NON_INTERACTIVE%"=="1" exit /b 0
pause
exit /b 0

:fatal
echo [FATAL] Falha ao inicializar control center.
call :maybe_pause
exit /b 1

:end
echo Encerrado.
endlocal
exit /b 0
