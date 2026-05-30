@echo off
REM ============================================================
REM  Draft Mundial 26 - arranque local
REM  Doble clic o ejecutar: start.bat
REM ============================================================
setlocal
cd /d "%~dp0"

REM Usa el almacen de certificados de Windows (proxy SSL corporativo)
set NODE_OPTIONS=--use-system-ca

if not exist ".env.local" (
  echo.
  echo [!] No existe .env.local
  echo     Copia .env.local.example a .env.local y rellena las claves de Supabase.
  echo.
  copy ".env.local.example" ".env.local" >nul
  echo     Se ha creado .env.local con valores de ejemplo. Editalo antes de continuar.
  echo.
  pause
)

if not exist "node_modules\next" (
  echo Instalando dependencias...
  call npm install --no-audit --no-fund
)

echo.
echo Arrancando en http://localhost:3000  (Ctrl+C para parar)
echo.

REM Abre Chrome en localhost tras unos segundos (cuando el server ya esta listo)
start "DraftMundial" /min cmd /c "timeout /t 4 /nobreak >nul & start chrome http://localhost:3000 || start http://localhost:3000"

call npm run dev
endlocal
