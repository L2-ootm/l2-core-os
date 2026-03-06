@echo off
setlocal EnableExtensions EnableDelayedExpansion

title [L2 CORE OS] Control Center

:: ==============================================================
:: L2 CORE OS - THE 1B VISION - FAST BOOTSTRAPPER
:: ==============================================================

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PROJECT_ROOT=%SCRIPT_DIR%"

:: Find docker compose file
if not exist "%PROJECT_ROOT%\infra\docker-compose.yml" set "PROJECT_ROOT=%SCRIPT_DIR%\.."
if not exist "%PROJECT_ROOT%\infra\docker-compose.yml" (
  echo [ERROR] Cannot find infra\docker-compose.yml
  pause >nul
  exit /b 1
)

set "COMPOSE_FILE=%PROJECT_ROOT%\infra\docker-compose.yml"
set "ENV_FILE=%PROJECT_ROOT%\infra\.env"
set "ENV_EXAMPLE=%PROJECT_ROOT%\infra\.env.example"
set "UI_DIR=%PROJECT_ROOT%\apps\web-ui"

cd /d "%PROJECT_ROOT%"

:menu
cls
echo.
echo    ===================================================
echo    # L2 CORE OS - COMMAND CENTER
echo    ===================================================
echo.
echo    [1] INICIAR O SISTEMA L2 (API + Web Dashboard)
echo    [2] Encerrar o Sistema
echo    [3] Reiniciar
echo    [4] Ver Logs em Tempo Real
echo    [5] Limpar Ambiente (.env reset)
echo    [0] Sair
echo.
echo    ===================================================

set /p op="> OPCAO: "
if "%op%"=="1" goto :action_start
if "%op%"=="2" goto :action_stop
if "%op%"=="3" goto :action_restart
if "%op%"=="4" goto :action_logs
if "%op%"=="5" goto :action_reset
if "%op%"=="0" exit /b 0

echo [!] Opcao Invalida.
timeout /t 1 >nul
goto :menu


:: =================================
:: CORE ACTIONS
:: =================================

:action_start
echo.
echo [1/3] Preparando Ambiente Dark Luxury...

:: Garantir .env
if not exist "%ENV_FILE%" (
  if exist "%ENV_EXAMPLE%" (
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    echo       - Arquivo .env gerado.
  )
)

:: Auto-detect hardware from the HOST machine and write JSON for the Docker API
echo       - Escaneando hardware do host...
set "HW_JSON=%PROJECT_ROOT%\apps\api\hardware_scan.json"
set "HW_CPU=Unknown CPU"
set "HW_RAM=Unknown"
set "HW_GPU=Acelerador Grafico Basico"

:: Detect CPU
for /f "tokens=2 delims==" %%a in ('wmic cpu get name /value 2^>nul ^| findstr /i "Name="') do set "HW_CPU=%%a"

:: Detect RAM (in GB)
for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value 2^>nul ^| findstr /i "TotalPhysicalMemory="') do (
  set /a "HW_RAM_GB=%%a / 1073741824"
)
if defined HW_RAM_GB set "HW_RAM=!HW_RAM_GB! GB"

:: Detect GPU
for /f "tokens=2 delims==" %%a in ('wmic path win32_VideoController get name /value 2^>nul ^| findstr /i "Name="') do (
  if "%%a" NEQ "" set "HW_GPU=%%a"
)

:: Write JSON
(
  echo {
  echo   "cpu": "!HW_CPU!",
  echo   "ram": "!HW_RAM!",
  echo   "gpu": "!HW_GPU!"
  echo }
) > "%HW_JSON%"
echo       - Hardware detectado: !HW_CPU! / !HW_RAM! / !HW_GPU!

:: Verificar Docker
docker version >nul 2>&1
if !errorlevel! NEQ 0 (
    echo [2/3] Docker desativado! Ligando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo       - Aguardando o kernel do Docker ligar. Cerca de 10 segundos...
    timeout /t 10 /nobreak >nul
)

echo [2/3] Levantando a Infraestrutura de Backend L2...
docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" up -d
if !errorlevel! NEQ 0 (
    echo [ERROR] Falha ao subir os containeres.
    pause
    goto :menu
)

echo [3/3] Acionando a Interface do Cockpit Web...
if exist "%UI_DIR%\package.json" (
  :: Starts the Vite dev server in a totally detached terminal window
  start "L2 OS Web Engine" /D "%UI_DIR%" cmd /c "npm run dev"
  
  echo       - Servidores operantes. L2 CORE OS decolando...
  :: Just give Vite precisely 3 seconds to spin up, then launch chrome
  timeout /t 3 /nobreak >nul
  start http://localhost:8080
) else (
  echo [!] UI source nao encontrada. Abrindo painel de producao.
  start http://localhost:3000
)

echo.
echo L2 CORE OS ONLINE.
pause
goto :menu

:action_stop
echo.
echo Baixando Infraestrutura...
docker compose -f "%COMPOSE_FILE%" down
echo Desligamento Concluido.
pause
goto :menu

:action_restart
call :action_stop
call :action_start
goto :menu

:action_logs
cls
echo [ Logs da Infraestrutura L2 - Pressione CTRL+C para voltar ]
docker compose -f "%COMPOSE_FILE%" logs -f
goto :menu

:action_reset
echo.
echo Tem certeza que deseja destruir o arquivo .env atual?
set /p confirm="Digite 'S' para confirmar: "
if /i "%confirm%"=="S" (
    del /f /q "%ENV_FILE%" >nul 2>&1
    echo Ambiente limpado. O script recriara na proxima inicializacao.
)
pause
goto :menu
