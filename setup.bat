@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       Control Tower IA  -  Setup         ║
echo  ║    Automatización Logística - BLY ARG    ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Verificar Python ─────────────────────────────────────
echo [1/5] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python no encontrado.
    echo  Descarga Python 3.11+ desde https://python.org
    pause & exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo  OK - Python %PY_VER%

:: ── Crear entorno virtual Python ────────────────────────
echo.
echo [2/5] Creando entorno virtual Python...
if exist "backend\venv" (
    echo  Ya existe. Omitiendo creacion.
) else (
    cd backend
    python -m venv venv
    cd ..
    echo  Entorno creado.
)

:: ── Instalar dependencias Python ─────────────────────────
echo.
echo [3/5] Instalando dependencias Python...
call backend\venv\Scripts\activate.bat
pip install --quiet --upgrade pip
pip install --quiet -r backend\requirements.txt
echo  Dependencias Python instaladas.

:: ── Instalar dependencias Node.js ────────────────────────
echo.
echo [4/5] Instalando dependencias Node.js...
call npm install --silent
echo  Dependencias Node.js instaladas.

:: ── Instalar Ollama (IA local offline) ──────────────────
echo.
echo [5/5] Verificando Ollama (IA local)...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo  AVISO: Ollama no encontrado.
    echo  Para habilitar la IA offline, descarga Ollama desde:
    echo  https://ollama.com/download
    echo  Luego ejecuta: ollama pull mistral
    echo.
    echo  La app funciona sin IA en Etapa 1.
) else (
    echo  Ollama detectado.
    echo  Descargando modelo mistral (puede tardar unos minutos)...
    ollama pull mistral
    echo  Modelo listo.
)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Setup completado correctamente!   ║
echo  ║   Ejecuta start_dev.bat para        ║
echo  ║   iniciar Control Tower IA          ║
echo  ╚══════════════════════════════════════╝
echo.
pause
