@echo off
setlocal enabledelayedexpansion

cd /d %~dp0
set COMPOSE=docker compose -f infra/docker-compose.yml --env-file infra/.env

:menu
cls
echo =========================================
echo L2 CORE OS - CONTROL CENTER (Windows)
echo =========================================
echo [1] Start seguro (up + health)
echo [2] Stop (down)
echo [3] Restart seguro
echo [4] Status consolidado
echo [5] Logs rapidos (api/gateway/db)
echo [6] GO/NO-GO
echo [7] WhatsApp recover (reconnect + catchup)
echo [8] Abrir dashboard web
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
if "%op%"=="0" goto end
goto menu

:start_safe
call :ensure_env
%COMPOSE% up -d
if errorlevel 1 (
  echo [ERRO] Falha ao subir stack.
  pause
  goto menu
)
timeout /t 6 /nobreak >nul
powershell -NoProfile -Command "try{(Invoke-RestMethod 'http://localhost:8000/health').ok}catch{$false}" >nul
if errorlevel 1 (
  echo [AVISO] API ainda inicializando.
) else (
  echo [OK] Stack iniciada com sucesso.
)
pause
goto menu

:stop
%COMPOSE% down
echo [OK] Stack parada.
pause
goto menu

:restart_safe
%COMPOSE% down
%COMPOSE% up -d
timeout /t 6 /nobreak >nul
echo [OK] Restart concluido.
pause
goto menu

:status
echo --- Docker compose ps ---
%COMPOSE% ps
echo.
echo --- API health ---
powershell -NoProfile -Command "try{Invoke-RestMethod 'http://localhost:8000/health' | ConvertTo-Json -Depth 4}catch{$_|Out-String}"
echo.
echo --- WhatsApp status ---
powershell -NoProfile -Command "try{Invoke-RestMethod 'http://localhost:8090/session/status' | ConvertTo-Json -Depth 6}catch{$_|Out-String}"
pause
goto menu

:logs
echo [1] API  [2] Gateway  [3] DB
set /p lg=Servico: 
if "%lg%"=="1" %COMPOSE% logs api --tail 120
if "%lg%"=="2" %COMPOSE% logs baileys-gateway --tail 120
if "%lg%"=="3" %COMPOSE% logs db --tail 120
pause
goto menu

:go_nogo
powershell -ExecutionPolicy Bypass -File infra\scripts\e2e-go-no-go.ps1
pause
goto menu

:wa_recover
powershell -NoProfile -Command "try{Invoke-RestMethod -Method Post 'http://localhost:8090/session/connect' | Out-Null}catch{}; Start-Sleep -Seconds 2; try{Invoke-RestMethod -Method Post 'http://localhost:8090/session/catchup' | ConvertTo-Json -Depth 6}catch{$_|Out-String}"
pause
goto menu

:open_web
start http://localhost:3000
goto menu

:ensure_env
if not exist infra\.env (
  if exist infra\.env.example (
    copy infra\.env.example infra\.env >nul
    echo [infra/.env] criado a partir de infra/.env.example
  ) else (
    echo [ERRO] .env.example nao encontrado.
  )
)
exit /b 0

:end
echo Encerrado.
endlocal
