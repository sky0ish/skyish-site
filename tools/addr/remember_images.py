# -*- coding: utf-8 -*-
"""
리멤버 명함첩의 그림을 주소록 폴더로 — 얼굴(아바타)은 9.FACE 에, 명함 스캔은 00.주소록/리멤버_명함 에

  「리멤버 파일에서 얼굴 사진 있는 경우 모두 주소록 사진에 반영해줘」
  「위의 리멤버의 경우는 1번으로 긁어와줘」 (명함 스캔 그림)

  들어오는 것 : 00.주소록/리멤버_명함이력.json  (리멤버 웹 명함첩에서 내려받은 명함 묶음 —
                한 사람(stack)마다 대표 명함(main)과 옛 명함들(subs), 각 명함의 그림 주소)
  나가는 것  :
    9.FACE/이름_소속.jpg                    ← 아바타(얼굴). 대표 명함에 없으면 가장 새 옛 명함의 것
                                              (파일 이름 규칙은 addr-pack.js 의 faceFileStem 과 같습니다)
    00.주소록/리멤버_명함/이름_소속_<명함번호>.jpg ← 명함 앞면 스캔. 옛 명함도 모두 (번호로 가릅니다)

  · 이미 있는 파일은 건드리지 않습니다 (손수 넣어 두신 얼굴이 우선입니다)
  · 그림 주소는 로그인 없이 열립니다 — 그래서 파이썬으로 곧바로 받습니다
  · 크롬에서 먼저 받아 둔 remember_img_*.zip (avatars/<번호>.jpg, fronts/<번호>.jpg) 이
    다운로드 폴더에 있으면 그 안의 것을 먼저 씁니다
  · 두 폴더 모두 .gitignore 에 있어 깃헙에는 올라가지 않습니다

돌리는 법 :  python tools/addr/remember_images.py [--dry]
"""
import glob, io, json, os, re, sys, time, zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HOME, "00.주소록", "리멤버_명함이력.json")
FACE = os.path.join(HOME, "9.FACE")
CARDS = os.path.join(HOME, "00.주소록", "리멤버_명함")
ZIPS = sorted(glob.glob(os.path.join(os.path.expanduser("~"), "Downloads", "remember_img_*.zip")))
DRY = "--dry" in sys.argv
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")


def safe(name):
    """addressbook.js 의 safeFileName — 파일에 못 쓰는 글자만 걷어냅니다"""
    s = re.sub(r'[\\/:*?"<>|]', "_", str(name or ""))
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^\.+", "", s)
    return s[:60]


def face_stem(name, org):
    """addr-pack.js 의 faceFileStem — 「이름_소속」. 소속의 괄호 덩이·밑줄은 미리 걷어냅니다"""
    def tidy(t):
        t = safe(t)
        t = re.sub(r"[（(].*?[）)]", " ", t)
        t = re.sub(r"[_()（）]", " ", t)
        return re.sub(r"\s+", " ", t).strip()
    n, o = tidy(name), tidy(org)
    return n + ("_" + o if o else "")


def exists_stem(folder, stem):
    for ext in IMG_EXT:
        if os.path.exists(os.path.join(folder, stem + ext)):
            return True
    return False


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
                data = r.read()
            if data[:2] == b"\xff\xd8" or data[:8] == b"\x89PNG\r\n\x1a\n":
                return data
            last = "그림이 아님 (%d bytes)" % len(data)
        except Exception as e:
            last = str(e)
        time.sleep(1 + i)
    raise RuntimeError(last)


def main():
    doc = json.load(io.open(SRC, encoding="utf-8"))
    stacks = doc["stacks"]
    os.makedirs(FACE, exist_ok=True)
    os.makedirs(CARDS, exist_ok=True)

    # 크롬에서 받아 둔 zip 안의 것 — 번호 → (zip, 안의 이름)
    inzip = {}
    zfs = []
    for zp in ZIPS:
        try:
            zf = zipfile.ZipFile(zp)
        except Exception:
            continue
        zfs.append(zf)
        for n in zf.namelist():
            m = re.match(r"(avatars|fronts)/(\d+)\.jpg$", n)
            if m:
                inzip[(m.group(1), int(m.group(2)))] = (zf, n)
    print("zip 에서 쓸 수 있는 그림 %d개 (%s)" % (len(inzip), ", ".join(os.path.basename(z) for z in ZIPS) or "없음"))

    jobs = []          # (종류, 목적지 파일, 번호, url)
    used = set()
    skip_have = 0
    for s in stacks:
        m = s["main"]
        cards = [m] + sorted(s["subs"], key=lambda c: c["at"] or "", reverse=True)
        name = (m["name"] or "").strip()
        if not name:
            continue
        stem = face_stem(name, m["company"])
        # ── 얼굴 ──
        av = next((c for c in cards if c.get("avatar") and c["avatar"].get("original")), None)
        if av:
            st2 = stem
            k = 2
            while st2 in used:                      # 같은 이름·소속의 다른 분
                st2 = stem + "_" + str(k); k += 1
            used.add(st2)
            if exists_stem(FACE, st2):
                skip_have += 1
            else:
                jobs.append(("avatars", os.path.join(FACE, st2 + ".jpg"), av["id"], av["avatar"]["original"]))
        # ── 명함 앞면 (옛 명함까지) ──
        for c in cards:
            fr = c.get("front")
            if not fr or not fr.get("original"):
                continue
            cstem = face_stem((c["name"] or name).strip(), c["company"]) + "_" + str(c["id"])
            dst = os.path.join(CARDS, cstem + ".jpg")
            if os.path.exists(dst):
                skip_have += 1
            else:
                jobs.append(("fronts", dst, c["id"], fr["original"]))

    print("받을 것 %d개 (얼굴 %d · 명함 %d) · 이미 있어 건너뜀 %d" % (
        len(jobs), sum(1 for j in jobs if j[0] == "avatars"), sum(1 for j in jobs if j[0] == "fronts"), skip_have))
    if DRY:
        for j in jobs[:15]:
            print("  ", j[0], os.path.relpath(j[1], HOME))
        return

    def one(job):
        kind, dst, cid, url = job
        hit = inzip.get((kind, cid))
        if hit:
            data = hit[0].read(hit[1])
            src = "zip"
        else:
            data = fetch(url)
            src = "web"
        if kind == "avatars" and len(data) < 5000:
            return "blank", 0                     # 리멤버 기본 그림(회색 사람 모양·빈 4×4) — 얼굴이 아닙니다
        tmp = dst + ".part"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, dst)
        return src, len(data)

    ok = bad = blank = 0
    nz = nw = 0
    total = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(one, j): j for j in jobs}
        for i, f in enumerate(as_completed(futs), 1):
            j = futs[f]
            try:
                src, n = f.result()
                if src == "blank":
                    blank += 1; continue
                ok += 1; total += n
                if src == "zip": nz += 1
                else: nw += 1
            except Exception as e:
                bad += 1
                print("  실패:", os.path.relpath(j[1], HOME), "—", e)
            if i % 200 == 0 or i == len(jobs):
                print("  %d/%d · zip %d · 웹 %d · 실패 %d · %.0f MB · %.0f초" % (i, len(jobs), nz, nw, bad, total / 1048576, time.time() - t0))
    for zf in zfs:
        zf.close()
    nf = sum(1 for n in os.listdir(FACE) if n.lower().endswith(IMG_EXT))
    nc = sum(1 for n in os.listdir(CARDS) if n.lower().endswith(IMG_EXT))
    print("끝 — 받음 %d · 빈 얼굴이라 건너뜀 %d · 실패 %d · 9.FACE 그림 %d개 · 리멤버_명함 그림 %d개" % (ok, blank, bad, nf, nc))


if __name__ == "__main__":
    main()
