@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   Control Tower IA  -  Build Installer      ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── Verificar entorno ──────────────────────────────────
if not exist "backend\venv\Scripts\activate.bat" (
    echo  ERROR: Ejecuta setup.bat primero.
    pause & exit /b 1
)
if not exist "node_modules" (
    echo  ERROR: Ejecuta setup.bat primero.
    pause & exit /b 1
)

:: ── 1. Instalar PyInstaller ────────────────────────────
echo [1/4] Instalando PyInstaller...
call backend\venv\Scripts\activate.bat
pip install pyinstaller --quiet
echo  OK

:: ── 2. Compilar backend Python ─────────────────────────
echo.
echo [2/4] Compilando backend Python (puede tardar 2-3 min)...
cd backend
if exist "dist\run" rmdir /s /q "dist\run"
pyinstaller run.spec --clean --noconfirm --distpath dist
if errorlevel 1 (
    echo  ERROR: Fallo la compilacion del backend Python.
    cd ..
    pause & exit /b 1
)
cd ..
echo  Backend compilado en backend\dist\run\

:: ── 3. Compilar frontend Electron ─────────────────────
echo.
echo [3/4] Compilando frontend Electron...
call npm run build
if errorlevel 1 (
    echo  ERROR: Fallo la compilacion del frontend.
    pause & exit /b 1
)
echo  Frontend compilado en out\

:: ── 4. Empaquetar app Electron ────────────────────────────
echo.
echo [4/4] Empaquetando app Electron...
call npx electron-builder --win dir
if errorlevel 1 (
    echo  ERROR: Fallo el empaquetado.
    pause & exit /b 1
)

:: ── 5. Crear ZIP distribuible ─────────────────────────────
echo.
echo [5/5] Creando ZIP distribuible...
powershell -Command "Compress-Archive -Path 'dist\win-unpacked\*' -DestinationPath 'dist\ControlTowerIA_v1.0.0_Windows.zip' -Force"

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║   Build completado!                                      ║
echo  ║   Archivo: dist\ControlTowerIA_v1.0.0_Windows.zip       ║
echo  ║   Instrucciones: ver INSTALL.md                         ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.
pause
