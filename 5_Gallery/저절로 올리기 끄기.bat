@echo off
chcp 65001 >nul
title 저절로 올리기 끄기
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 이 없습니다. https://www.python.org 에서 받아 설치해주세요.
  pause
  exit /b
)
python "_지킴이등록.py" off
echo.
echo   손수 올리실 때는 「사진첩에 올리기」를 누르시면 됩니다.
echo.
pause
