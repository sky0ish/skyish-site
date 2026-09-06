@echo off
chcp 65001 >nul
title 사진첩에 올리기
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 이 없습니다. https://www.python.org 에서 받아 설치해주세요.
  pause
  exit /b
)
python "_올리기.py"
