# -*- coding: utf-8 -*-
r"""지킴이를 「시작프로그램」에 넣거나 뺍니다.

    python _지킴이등록.py on     넣기
    python _지킴이등록.py off    빼기
"""
import os, sys, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
WATCHER = os.path.join(HERE, "_지켜보기.pyw")
LNK_NAME = "skyish 사진첩 지킴이.lnk"


def startup_dir():
    return os.path.join(os.environ["APPDATA"], "Microsoft", "Windows",
                        "Start Menu", "Programs", "Startup")


def pythonw():
    exe = sys.executable
    cand = os.path.join(os.path.dirname(exe), "pythonw.exe")
    return cand if os.path.exists(cand) else exe


def make_shortcut(path, target, args, workdir, desc):
    ps = (
        "$s = New-Object -ComObject WScript.Shell; "
        "$l = $s.CreateShortcut([Environment]::ExpandEnvironmentVariables($env:LNK)); "
        "$l.TargetPath = $env:TGT; $l.Arguments = $env:ARG; "
        "$l.WorkingDirectory = $env:WD; $l.Description = $env:DSC; $l.Save()"
    )
    env = dict(os.environ, LNK=path, TGT=target, ARG=args, WD=workdir, DSC=desc)
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-Command", ps], env=env, check=True,
                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def turn_on():
    lnk = os.path.join(startup_dir(), LNK_NAME)
    make_shortcut(lnk, pythonw(), '"%s"' % WATCHER, HERE,
                  "5_Gallery 사진이 바뀌면 skyish.kr 사진첩에 올립니다")
    print("  컴퓨터를 켤 때마다 저절로 돌도록 등록했습니다.")
    print("  " + lnk)
    # 지금 바로 하나 띄웁니다
    subprocess.Popen([pythonw(), WATCHER], cwd=HERE,
                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    print("  지킴이를 켰습니다.")


def turn_off():
    lnk = os.path.join(startup_dir(), LNK_NAME)
    if os.path.exists(lnk):
        os.remove(lnk)
        print("  등록을 지웠습니다.")
    else:
        print("  등록되어 있지 않았습니다.")
    ps = ("Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | "
          "Where-Object { $_.CommandLine -like '*_지켜보기*' } | "
          "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }")
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-Command", ps],
                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    print("  돌고 있던 지킴이도 멈췄습니다.")


if __name__ == "__main__":
    what = (sys.argv[1] if len(sys.argv) > 1 else "on").lower()
    try:
        turn_on() if what == "on" else turn_off()
    except Exception as e:
        print("  뜻밖의 일이 생겼습니다 :", e)
