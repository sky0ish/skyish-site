@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  skyish.kr 배포 — DATA / 중첩규제 메뉴 추가
echo ============================================
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [X] 이 폴더가 git 저장소가 아닙니다. HP_hompage작성 폴더 안에서 실행해 주세요.
  goto end
)
echo [1/3] 메뉴·목록 화면만 담습니다
git add pictures.html assets/js/main.js deploy_regulation.cmd
git status --short
echo [2/3] 커밋
git commit -m "DATA: 중첩규제 하위메뉴·갈래 추가"
echo [3/3] GitHub 으로 올립니다
git push
if errorlevel 1 (
  echo [X] 푸시에 실패했습니다. 위 메시지를 그대로 알려 주세요.
  goto end
)
echo  올렸습니다. 1~2분 뒤 skyish.kr/pictures.html?cat=regulation 에 반영됩니다.
:end
pause
