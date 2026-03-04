@echo off
setlocal enabledelayedexpansion

cd /d %~dp0\..

if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    echo [.env] criado a partir de .env.example
  ) else (
    echo [ERRO] .env.example nao encontrado.
    exit /b 1
  )
)

echo ======================================
echo L2 Core OS Setup (Windows)
echo ======================================

docker --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Docker nao encontrado. Instale Docker Desktop e tente novamente.
  exit /b 1
)

for /f "tokens=*" %%i in ('docker compose version 2^>nul') do set DC_OK=1
if not defined DC_OK (
  echo [ERRO] Docker Compose nao encontrado.
  exit /b 1
)

echo [1/3] Subindo servicos...
docker compose -f docker-compose.yml --env-file .env up -d
if errorlevel 1 (
  echo [ERRO] Falha ao subir containers.
  exit /b 1
)

echo [2/3] Validando servicos...
timeout /t 6 /nobreak >nul
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
  echo [AVISO] API ainda inicializando. Aguarde mais alguns segundos.
)

echo [3/3] Setup finalizado.
echo Dashboard: http://localhost:3000
echo API: http://localhost:8000
echo Baileys: http://localhost:8090

echo.
echo Proximo passo: configure o WhatsApp via QR na UI do baileys-gateway.
endlocal
