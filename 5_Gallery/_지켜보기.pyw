# -*- coding: utf-8 -*-
r"""
5_Gallery 폴더를 지켜보다가, 사진이 바뀌면 그때만 올립니다.

  · 30초마다 폴더를 살핍니다. 파일을 열지 않고 이름·크기·시각만 봅니다.
    (구글 드라이브에서 내려받기를 일으키지 않습니다)
  · 바뀐 것이 보이면 20초 더 기다립니다.
    사진을 여러 장 복사하시는 중이면 다 끝난 뒤에 한 번만 올립니다.
  · 바뀐 것이 없으면 아무 일도 하지 않습니다.

  창이 뜨지 않습니다. 「저절로 올리기 끄기」로 멈추실 수 있습니다.
"""
import os, sys, time, subprocess, io

HERE = os.path.dirname(os.path.abspath(__file__))
UPLOADER = os.path.join(HERE, "_올리기.py")
LOG = os.path.join(HERE, "올린기록.txt")
EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")

LOOK_EVERY = 30       # 몇 초마다 살필지
SETTLE = 20           # 바뀐 뒤 몇 초 조용해야 올릴지


def note(msg):
    try:
        with io.open(LOG, "a", encoding="utf-8") as f:
            f.write(time.strftime("[%Y-%m-%d %H:%M] ") + msg + "\n")
    except Exception:
        pass


def snapshot():
    """폴더 속 사진들의 모습을 한 줄로 요약합니다 (파일을 열지 않습니다)."""
    out = []
    try:
        for d in sorted(os.scandir(HERE), key=lambda e: e.name):
            if not d.is_dir() or d.name.startswith((".", "_")):
                continue
            for f in sorted(os.scandir(d.path), key=lambda e: e.name):
                if f.is_file() and f.name.lower().endswith(EXTS):
                    st = f.stat()
                    out.append("%s/%s|%d|%d" % (d.name, f.name, st.st_size, int(st.st_mtime)))
    except Exception:
        return None
    return "\n".join(out)


def upload():
    exe = sys.executable
    if exe.lower().endswith("pythonw.exe"):
        exe = exe[:-len("pythonw.exe")] + "python.exe"
    try:
        subprocess.run([exe, UPLOADER, "--auto"], cwd=HERE,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                       timeout=3600)
    except Exception as e:
        note("올리다 멈췄습니다 : %s" % e)


def already_running():
    """지킴이가 이미 돌고 있으면 새로 뜨지 않습니다.
       (여러 개가 동시에 올려 앨범이 여러 개로 갈라지던 일을 막습니다)"""
    lock = os.path.join(HERE, ".지킴이.lock")
    try:
        if os.path.exists(lock) and time.time() - os.path.getmtime(lock) < 180:
            return True
    except Exception:
        pass
    return False


def touch_lock():
    try:
        with io.open(os.path.join(HERE, ".지킴이.lock"), "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
    except Exception:
        pass


def main():
    if already_running():
        return                      # 이미 하나 돌고 있습니다 — 조용히 물러납니다
    touch_lock()
    note("지킴이를 켰습니다. 사진이 바뀔 때만 올립니다.")
    last = snapshot()
    changed_at = None
    while True:
        time.sleep(LOOK_EVERY)
        touch_lock()                       # 「나 살아 있습니다」 표시
        now = snapshot()
        if now is None:
            continue                       # 드라이브가 잠깐 안 잡힐 때
        if now != last:
            last = now
            changed_at = time.time()       # 바뀌었다 — 조용해질 때까지 기다립니다
            continue
        if changed_at and time.time() - changed_at >= SETTLE:
            changed_at = None
            note("사진이 바뀌어 올립니다.")
            upload()
            last = snapshot()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        note("지킴이가 멈췄습니다 : %s" % e)
