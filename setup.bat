@echo off
title Paladium Redbubble Auto Uploader - Setup
echo =======================================================
echo   Paladium Redbubble Auto Uploader - First-Time Setup
echo =======================================================
echo.

cd /d "%~dp0"

if not exist ".venv" (
    echo [*] Creating local Python virtual environment (.venv)...
    python -m venv .venv
    if errorlevel 1 (
        echo [!] Error creating virtual environment. Ensure Python is installed and in PATH.
        pause
        exit /b 1
    )
)

echo [*] Activating virtual environment and upgrading pip...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip

echo [*] Installing requirements from requirements.txt...
pip install -r requirements.txt
if errorlevel 1 (
    echo [!] Error installing dependencies.
    pause
    exit /b 1
)

echo [*] Installing Playwright Chromium browser binaries...
playwright install chromium

echo.
echo =======================================================
echo   [SUCCESS] Setup completed successfully!
echo   Run 'run.bat' to launch the Streamlit Desktop GUI.
echo =======================================================
echo.
pause
