@echo off
title Steve OS — Voice Assistant Launcher
color 0A
echo.
echo  ==========================================
echo   Steve OS Voice Assistant
echo  ==========================================
echo.
echo  Choose launch mode:
echo    [1] Voice + Text mode (microphone)
echo    [2] Text-only mode    (no microphone)
echo    [3] GUI mode          (Tkinter window)
echo    [4] Run single command
echo.
set /p CHOICE=Enter choice (1/2/3/4): 

if "%CHOICE%"=="1" (
    echo.
    echo  Starting in Voice + Text mode...
    python assistant.py
)
if "%CHOICE%"=="2" (
    echo.
    echo  Starting in Text-only mode...
    python assistant.py --text
)
if "%CHOICE%"=="3" (
    echo.
    echo  Launching GUI...
    python voice_gui.py
)
if "%CHOICE%"=="4" (
    echo.
    set /p CMD=Enter command: 
    python assistant.py --text -c "%CMD%"
)

pause
