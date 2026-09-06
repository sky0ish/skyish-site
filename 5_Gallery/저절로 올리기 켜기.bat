@echo off
chcp 65001 >nul
title 저절로 올리기 켜기
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 이 없습니다. https://www.python.org 에서 받아 설치해주세요.
  pause
  exit /b
)

echo ============================================================
echo   1단계 - 홈페이지에 들어가서 지금 있는 사진을 올립니다
echo ============================================================
echo.
python "_올리기.py"

if not exist ".session.json" (
  echo.
  echo   들어가지 못해서 저절로 올리기는 켜지 않았습니다.
  echo   이메일과 비밀번호를 다시 확인하시고 한 번 더 눌러 주세요.
  echo.
  pause
  exit /b
)

echo.
echo ============================================================
echo   2단계 - 앞으로는 저절로 올라가게 합니다
echo ============================================================
echo.
python "_지킴이등록.py" on
echo.
echo   다 되었습니다.
echo   이제 이 폴더에 사진을 넣기만 하시면 저절로 올라갑니다.
echo.
pause
