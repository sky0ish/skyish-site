@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo  skyish.kr 배포 — BLOG 의 NEWS · YOUTUBE  /  Presentations 제목마다 행사 개요
echo ============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [X] 이 폴더가 git 저장소가 아닙니다.
  echo     HP_hompage작성 폴더 안에서 실행해 주세요.
  goto end
)

echo [1/5] 지금 바뀐 파일
git status --short
echo.

echo [2/5] 이번에 고친 파일만 담습니다
git add media.html assets/js/media.js assets/css/media.css assets/data/news/me-news.json assets/data/news/me-youtube.json
git add assets/js/main.js tools/news/me.py tools/news/collect.py
git add talk.html assets/js/talk.js assets/css/talk.css assets/data/talk-info.json assets/js/talks.js index.html
git add deploy_media.cmd
echo.

git diff --cached --quiet
if not errorlevel 1 (
  echo     새로 담을 것이 없습니다 — 이미 커밋돼 있습니다.
  goto pull
)

echo [3/5] 커밋
git commit -m "BLOG 에 NEWS·YOUTUBE (경기연구원 남지현 기사·영상, 날마다 자동 갱신) · Presentations 제목마다 행사 개요 쪽"
echo.

:pull
rem GitHub 의 news-bot 이 매일 뉴스 파일을 올려 두므로 먼저 받아 와야 푸시가 됩니다
echo [4/5] GitHub 에 먼저 올라간 것(최신뉴스 등)을 받아 옵니다
git pull --rebase --autostash
if errorlevel 1 (
  echo.
  echo [X] 받아 오다가 겹치는 곳이 생겼습니다 — 원래대로 되돌립니다.
  git rebase --abort >nul 2>&1
  echo     위 메시지를 그대로 알려 주세요.
  goto end
)
echo.

echo [5/5] GitHub 으로 올립니다
git push
if errorlevel 1 (
  echo.
  echo [X] 푸시에 실패했습니다. 위 메시지를 그대로 알려 주세요.
  echo     ^(로그인을 다시 물으면 창이 떴는지 확인해 주세요^)
  goto end
)

echo.
echo ============================================
echo  올렸습니다. 1~2분 뒤 skyish.kr 에 반영됩니다.
echo  BLOG 메뉴에 NEWS · YOUTUBE 가 보이고,
echo  첫 화면 Presentations 제목을 누르면 행사 개요가 열립니다.
echo ============================================

:end
echo.
pause
