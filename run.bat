@echo off
title Paladium Redbubble Auto Uploader - Streamlit Desktop GUI
cd /d "%~dp0"

if not exist ".venv\Scripts\streamlit.exe" (
    echo [!] Virtual environment not found. Running setup first...
    call setup.bat
)

echo [*] Launching Paladium Redbubble Auto Uploader GUI...
call .venv\Scripts\activate.bat
streamlit run app.py
