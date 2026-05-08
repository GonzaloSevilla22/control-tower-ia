@echo off
chcp 65001 > nul
echo.
echo  ┌─────────────────────────────────────┐
echo  │  Control Tower IA  -  Iniciando...  │
echo  └─────────────────────────────────────┘
echo.

:: Verificar que el setup fue ejecutado
if not exist "backend\venv\Scripts\activate.bat" (
    echo  ERROR: Entorno virtual no encontrado.
    echo  Ejecuta setup.bat primero.
    pause & exit /b 1
)

if not exist "node_modules" (
    echo  ERROR: node_modules no encontrado.
    echo  Ejecuta setup.bat primero.
    pause & exit /b 1
)

echo  Iniciando backend Python en puerto 8765...
start "Control Tower IA - Backend" cmd /k "title Control Tower IA [Backend] && call backend\venv\Scripts\activate.bat && cd backend && python run.py"

echo  Esperando que el backend este listo...
timeout /t 4 /nobreak > nul

echo  Iniciando interfaz Electron...
npm run dev

