@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo  skyish.kr 배포 — 해야할일 맨 위로 · 홈에 To BUY · 폰 주소록 검색창
echo ============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [X] 이 폴더가 git 저장소가 아닙니다.
  echo     HP_hompage작성 폴더 안에서 실행해 주세요.
  goto end
)

echo [1/4] 지금 바뀐 파일
git status --short
echo.

echo [2/4] 이번에 고친 파일만 담습니다
git add assets/js/todo.js assets/js/todo-list.js assets/js/contact-tabs.js assets/js/addressbook.js assets/css/style.css index.html contact.html tools/test/todo.mjs deploy_todo.cmd
echo.

git diff --cached --quiet
if not errorlevel 1 (
  echo     담을 것이 없습니다 — 이미 커밋돼 있습니다. 푸시만 해 봅니다.
  goto push
)

echo [3/4] 커밋
git commit -m "해야할일: 새 줄은 맨 위로 · 홈에 To BUY 나란히 · 폰 주소록은 설명 없이 검색창부터"
echo.

:push
echo [4/4] GitHub 으로 올립니다
git push
if errorlevel 1 (
  echo.
  echo [X] 푸시에 실패했습니다. 위 메시지를 그대로 알려 주세요.
  goto end
)

echo.
echo ============================================
echo  올렸습니다. 1~2분 뒤 skyish.kr 에 반영됩니다.
echo ============================================

:end
echo.
pause
