@echo off
setlocal

echo ================================
echo L2 CORE OS - AI PREFLIGHT CHECK
echo ================================

for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value ^| find "="') do set RAM_BYTES=%%a
if "%RAM_BYTES%"=="" (
  echo [ERRO] Nao foi possivel detectar RAM.
  exit /b 1
)

set /a RAM_GB=%RAM_BYTES:~0,-9%
if %RAM_GB% GEQ 16 (
  echo TIER=A
  echo Recomendacao: LLM local 7B quantizado.
) else if %RAM_GB% GEQ 8 (
  echo TIER=B
  echo Recomendacao: LLM local 3B quantizado.
) else (
  echo TIER=C
  echo Recomendacao: fallback deterministico sem LLM.
)

echo RAM detectada: ~%RAM_GB% GB
endlocal
