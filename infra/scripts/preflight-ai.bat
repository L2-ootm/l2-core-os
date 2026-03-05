@echo off
setlocal enabledelayedexpansion

set REPORT=infra\scripts\preflight-ai-report.json

echo ================================
echo L2 CORE OS - AI PREFLIGHT CHECK V2
echo ================================

for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value ^| find "="') do set RAM_BYTES=%%a
for /f "tokens=2 delims==" %%a in ('wmic cpu get NumberOfLogicalProcessors /value ^| find "="') do set CPU_LOGICAL=%%a

if "%RAM_BYTES%"=="" (
  echo [ERRO] Nao foi possivel detectar RAM.
  exit /b 1
)
if "%CPU_LOGICAL%"=="" set CPU_LOGICAL=2

set /a RAM_GB=%RAM_BYTES:~0,-9%
set /a RAM_EFFECTIVE=RAM_GB-2
if %RAM_EFFECTIVE% LSS 1 set RAM_EFFECTIVE=1

set TESTS=80
for /f %%i in ('powershell -NoProfile -Command "$sw=[Diagnostics.Stopwatch]::StartNew(); 1..80 | %% { $x=0; 1..5000 | %% { $x += [math]::Sqrt($_) } }; $sw.Stop(); [int][math]::Round($sw.Elapsed.TotalMilliseconds,0)"') do set TOTAL_MS=%%i
if "%TOTAL_MS%"=="" set TOTAL_MS=999999

set /a P95_MS=TOTAL_MS/TESTS
set ALLOWED_INSTALL=false
set TIER=C
set MODE=deterministic_fallback
set REASON=insufficient_resources

if %RAM_EFFECTIVE% GEQ 14 if %CPU_LOGICAL% GEQ 8 if %P95_MS% LEQ 2500 (
  set TIER=A
  set MODE=local_llm_7b
  set ALLOWED_INSTALL=true
  set REASON=meets_tier_a
) else if %RAM_EFFECTIVE% GEQ 6 if %CPU_LOGICAL% GEQ 4 if %P95_MS% LEQ 2500 (
  set TIER=B
  set MODE=local_llm_3b
  set ALLOWED_INSTALL=true
  set REASON=meets_tier_b
)

echo {> %REPORT%
echo   "ram_gb": %RAM_GB%,>> %REPORT%
echo   "ram_effective_gb": %RAM_EFFECTIVE%,>> %REPORT%
echo   "cpu_logical": %CPU_LOGICAL%,>> %REPORT%
echo   "tests": %TESTS%,>> %REPORT%
echo   "estimated_p95_ms": %P95_MS%,>> %REPORT%
echo   "tier": "%TIER%",>> %REPORT%
echo   "mode": "%MODE%",>> %REPORT%
echo   "allowed_install": %ALLOWED_INSTALL%,>> %REPORT%
echo   "reason": "%REASON%">> %REPORT%
echo }>> %REPORT%

echo TIER=%TIER%
echo MODE=%MODE%
echo allowed_install=%ALLOWED_INSTALL%
echo report=%REPORT%

endlocal