# -*- coding: utf-8 -*-
r"""
5_Gallery 폴더의 사진을 skyish.kr 사진첩에 올립니다.

  폴더 짓는 법 :  5_Gallery\20260905_[건축] 세운상가 답사\*.jpg
                  │        │
                  │        └ [말머리] 가 앨범 갈래를 정합니다
                  └ 앞 8자리가 행사 날짜 (2026-09-05 처럼 줄표도 됩니다)

  쓸 수 있는 말머리
    [도시]  [건축]  [건축가]  [집]  [일상]  [기타]

  말머리를 안 붙이셔도 됩니다 — 폴더 이름을 보고 알아서 고릅니다.

  하는 일
    · 폴더 하나가 앨범 하나가 됩니다.
      앨범 이름은  2026.09.05 세운상가 답사  꼴이 됩니다.
    · 폴더 이름을 나중에 고치셔도 같은 앨범으로 갑니다.
      (폴더 안에 .앨범정보.json 이름표를 두어 기억합니다 — 지우지 마세요)
    · 사진은 긴 변 2000픽셀로 줄여 올립니다 (원본은 그대로 둡니다).
    · 이미 올린 사진은 건너뜁니다. 새 사진만 올라갑니다.

  처음 한 번만 아이디와 비밀번호를 물어봅니다.
  그 뒤로는 저장해 둔 표를 씁니다.
"""
import io, os, sys, json, time, random, string, getpass, mimetypes, re

try:
    import requests
except ImportError:
    print("requests 꾸러미가 없습니다.  명령창에서:  pip install requests")
    sys.exit(1)

AUTO = "--auto" in sys.argv      # 저절로 돌 때 (묻지 않고 조용히, 기록만 남김)
HERE = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(HERE, "올린기록.txt")
SUPABASE_URL = "https://qmdovjlxfvinknuizelw.supabase.co"
SUPABASE_KEY = "sb_publishable_apVDoDrUDbKJTnlSyEbhlw_jhMSiUnd"
SITE = "skyish.kr"
BUCKET = "gallery"
SESSION_FILE = os.path.join(HERE, ".session.json")
LEDGER_FILE = os.path.join(HERE, ".올린목록.json")
MAX_SIDE = 2000                # 긴 변 기준 줄이는 크기
EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")

# [말머리] 로 갈래를 콕 집어 정하실 때 (이것이 가장 먼저입니다)
CAT_TAG = {
    "도시": "urban", "Urban": "urban", "urban": "urban",
    "건축": "arch", "Architecture": "arch", "arch": "arch",
    "건축가": "architects", "Architects": "architects",
    "집": "house", "House": "house", "주택": "house",
    "일상": "daily", "Daily": "daily",
    "기타": "etc", "ETC": "etc",
}

# 말머리가 없으면 폴더 이름에 든 말로 짐작합니다 (위에서부터 먼저 맞는 것)
CAT_RULES = [
    ("architects", ["건축가", "인터뷰", "작가"]),
    ("arch",       ["건축", "답사", "미술관", "박물관", "전시", "설계"]),
    ("urban",      ["도시", "거리", "가로", "재생", "골목", "풍경"]),
    ("house",      ["집", "주택", "아파트", "인테리어"]),
    ("etc",        ["기타", "etc"]),
]
CAT_NAME = {"urban": "Urban", "arch": "Architecture", "architects": "Architects",
            "house": "House", "daily": "Daily Life", "etc": "ETC"}


def say(*a):
    """화면에 적고, 저절로 도는 중이면 기록 파일에도 남깁니다."""
    line = " ".join(str(x) for x in a)
    try:
        print(line, flush=True)
    except Exception:
        pass
    if AUTO:
        try:
            with io.open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception:
            pass


def load_json(path, default):
    try:
        return json.load(io.open(path, encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    io.open(path, "w", encoding="utf-8").write(
        json.dumps(data, ensure_ascii=False, indent=1))


# ── 로그인 ────────────────────────────────────────────────
def api(path):
    return SUPABASE_URL.rstrip("/") + path


def login():
    """저장해 둔 표를 먼저 쓰고, 없거나 만료면 다시 여쭙습니다."""
    s = load_json(SESSION_FILE, {})
    if s.get("refresh_token"):
        r = requests.post(api("/auth/v1/token?grant_type=refresh_token"),
                          headers={"apikey": SUPABASE_KEY,
                                   "Content-Type": "application/json"},
                          json={"refresh_token": s["refresh_token"]}, timeout=30)
        if r.ok:
            d = r.json()
            save_json(SESSION_FILE, {"refresh_token": d["refresh_token"]})
            return d["access_token"], d["user"]["id"]
        say("  저장해 둔 표가 만료되었습니다. 다시 여쭙겠습니다.")

    if AUTO:
        say("  아직 들어간 적이 없습니다 — 「갤러리에 올리기」를 한 번 눌러 주세요.")
        sys.exit(0)
    say()
    say("운영진 계정으로 한 번만 들어가 주세요.")
    say("(비밀번호는 이 컴퓨터 밖으로 나가지 않고, 화면에도 찍히지 않습니다)")
    email = input("  이메일   : ").strip()
    pw = getpass.getpass("  비밀번호 : ")
    r = requests.post(api("/auth/v1/token?grant_type=password"),
                      headers={"apikey": SUPABASE_KEY,
                               "Content-Type": "application/json"},
                      json={"email": email, "password": pw}, timeout=30)
    if not r.ok:
        say("  들어가지 못했습니다 :", r.text[:200])
        sys.exit(1)
    d = r.json()
    save_json(SESSION_FILE, {"refresh_token": d["refresh_token"]})
    say("  들어왔습니다.")
    return d["access_token"], d["user"]["id"]


def check_admin(token, uid):
    r = requests.get(api("/rest/v1/profiles?select=name,is_admin&id=eq." + uid),
                     headers={"apikey": SUPABASE_KEY,
                              "Authorization": "Bearer " + token}, timeout=30)
    rows = r.json() if r.ok else []
    if not rows:
        say("  이 계정으로는 올릴 수 없습니다.")
        sys.exit(1)
    return rows[0].get("name") or "나"


# ── 폴더 읽기 ──────────────────────────────────────────────
def parse_folder(name):
    """20260905_[포럼] 인문포럼 겸 발간기념회
         → ('2026-09-05', '인문포럼 겸 발간기념회', 'forum')
       말머리가 없으면 이름을 보고 갈래를 짐작합니다."""
    m = re.match(r"^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})[ _\-]*(.*)$", name)
    if not m:
        return None, name, "daily"
    y, mo, d, rest = m.groups()
    date = "%s-%s-%s" % (y, mo, d)
    rest = rest.strip()

    cat = None
    tag = re.match(r"^[\[【]\s*([^\]】]{1,12})\s*[\]】]\s*(.*)$", rest)
    if tag:
        word = tag.group(1).strip()
        cat = CAT_TAG.get(word) or CAT_TAG.get(word.replace(" ", ""))
        if cat:
            rest = tag.group(2).strip()       # 말머리는 제목에서 뺍니다
        else:
            say("     (말머리 「%s」 를 몰라서 이름으로 짐작합니다)" % word)
    if not cat:
        cat = pick_cat(rest or name)
    return date, (rest or name), cat


CAT_LABEL = {"urban": "도시", "arch": "건축", "architects": "건축가",
             "house": "집", "daily": "일상", "etc": "기타"}


def tidy_name(fname, date, title, cat):
    """폴더 이름을 늘 같은 모습으로 다듬습니다.
         20260905_인문포럼  →  2026.09.05_[포럼] 인문포럼
       이미 그 모습이면 그대로 둡니다."""
    want = "%s_[%s] %s" % (date.replace("-", "."), CAT_LABEL[cat], title)
    want = re.sub(r'[\\/:*?"<>|]', "", want).strip()
    if want == fname or not want:
        return fname
    src, dst = os.path.join(HERE, fname), os.path.join(HERE, want)
    if os.path.exists(dst):
        return fname                       # 같은 이름이 이미 있으면 건드리지 않습니다
    try:
        os.rename(src, dst)
        say("     폴더 이름을 다듬었습니다 → %s" % want)
        return want
    except Exception as e:
        say("     (폴더 이름은 그대로 둡니다 : %s)" % e)
        return fname


def pick_cat(title):
    for cat, words in CAT_RULES:
        for w in words:
            if w.lower() in title.lower():
                return cat
    return "daily"


def shrink(path):
    """긴 변 2000픽셀로 줄입니다. 못 줄이면 원본을 그대로 올립니다."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return io.open(path, "rb").read(), os.path.splitext(path)[1].lstrip(".").lower()
    try:
        im = Image.open(path)
        im = ImageOps.exif_transpose(im)          # 눕혀 찍은 사진 바로 세우기
        if max(im.size) > MAX_SIDE:
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        if im.mode in ("RGBA", "P", "LA"):
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=85, optimize=True)
        return buf.getvalue(), "jpg"
    except Exception:
        return io.open(path, "rb").read(), os.path.splitext(path)[1].lstrip(".").lower()


def rand(n=8):
    return "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(n))


def only_one(name):
    """같은 일이 두 번 겹쳐 돌지 않게 잠급니다."""
    lock = os.path.join(HERE, "." + name + ".lock")
    try:
        if os.path.exists(lock) and time.time() - os.path.getmtime(lock) < 3600:
            return None                       # 이미 누가 하고 있습니다
        io.open(lock, "w", encoding="utf-8").write(str(os.getpid()))
        return lock
    except Exception:
        return None


# ── 올리기 ────────────────────────────────────────────────
def main():
    say("=" * 58)
    say("  3_Gallery → 총동문회 갤러리 올리기")
    say("=" * 58)

    lock = only_one("올리는중")
    if not lock:
        say("  이미 올리고 있습니다. 이번에는 그냥 지나갑니다.")
        return

    token, uid = login()
    who = check_admin(token, uid)
    say("  %s 님으로 올립니다." % who)

    H = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + token}
    ledger = load_json(LEDGER_FILE, {})

    folders = [n for n in sorted(os.listdir(HERE))
               if os.path.isdir(os.path.join(HERE, n)) and not n.startswith((".", "_"))]
    if not folders:
        say()
        say("  올릴 폴더가 없습니다.")
        say("  이렇게 만들어 주세요 :  20260905_인문포럼")
        return

    total_new = 0
    for fname in folders:
        fdir = os.path.join(HERE, fname)
        say()
        date, title, cat = parse_folder(fname)
        if not date:
            say("  [건너뜀] %s — 앞에 날짜(20260905)가 없습니다." % fname)
            continue
        # 폴더 이름을 늘 같은 모습으로 (20260905_… → 2026.09.05_[포럼] …)
        newname = tidy_name(fname, date, title, cat)
        if newname != fname:
            for key in (fname,):
                if key in ledger:
                    ledger[newname] = ledger.pop(key)
                if key in ledger.get("_앨범", {}):
                    ledger["_앨범"][newname] = ledger["_앨범"].pop(key)
            fname, fdir = newname, os.path.join(HERE, newname)
            save_json(LEDGER_FILE, ledger)

        photos = [n for n in sorted(os.listdir(fdir))
                  if n.lower().endswith(EXTS)]
        mark, state = folder_state(fdir, fname, date, title, ledger)
        done = set(state.get("올린사진", []))
        todo = [n for n in photos if n not in done]

        shown = "%s %s" % (date.replace("-", "."), title)   # 2026.09.05 인문포럼…
        say("  ■ %s" % shown)
        say("     날짜 %s · 갈래 %s · 사진 %d장 (새것 %d장)"
            % (date, CAT_NAME[cat], len(photos), len(todo)))

        # 같은 폴더면 늘 같은 앨범으로 (두 번 올려도 앨범이 갈라지지 않습니다)

        # 앨범 만들기 — 이 홈피는 앨범을 id 로 이어 붙입니다.
        #   이름표에 적어 둔 id 가 있으면 제목만 고치고, 없으면 새로 만듭니다.
        alb_id = state.get("album_id")
        if alb_id:
            r = requests.patch(api("/rest/v1/gallery_albums?id=eq." + alb_id),
                               headers={**H, "Content-Type": "application/json",
                                        "Prefer": "return=representation"},
                               json={"title": shown, "category": cat,
                                     "event_date": date}, timeout=60)
            if not r.ok or not r.json():
                alb_id = None                      # 지워졌다면 새로 만듭니다
        if not alb_id:
            r = requests.post(api("/rest/v1/gallery_albums"),
                              headers={**H, "Content-Type": "application/json",
                                       "Prefer": "return=representation"},
                              json={"title": shown, "category": cat,
                                    "event_date": date, "created_by": uid,
                                    "owner_admin": True}, timeout=60)
            if not r.ok:
                say("     사진첩을 만들지 못했습니다 :", r.text[:200])
                continue
            alb_id = r.json()[0]["id"]
        state["album_id"] = alb_id
        save_json(mark, state)

        if not todo:
            say("     모두 올라가 있습니다.")
            continue

        ok = 0
        for i, n in enumerate(todo, 1):
            src = os.path.join(fdir, n)
            blob, ext = shrink(src)
            path = "%s/%s_%s.%s" % (cat, date, rand(), ext or "jpg")
            ctype = mimetypes.guess_type("x." + (ext or "jpg"))[0] or "image/jpeg"
            up = requests.post(api("/storage/v1/object/%s/%s" % (BUCKET, path)),
                               headers={**H, "Content-Type": ctype,
                                        "cache-control": "3600"},
                               data=blob, timeout=180)
            if not up.ok:
                say("     [실패] %s — %s" % (n, up.text[:120]))
                continue
            pub = "%s/storage/v1/object/public/%s/%s" % (
                SUPABASE_URL.rstrip("/"), BUCKET, path)
            ins = requests.post(api("/rest/v1/gallery_photos"),
                                headers={**H, "Content-Type": "application/json"},
                                json={"album_id": alb_id, "image_url": pub,
                                      "storage_path": path,
                                      "sort": len(done) + i,
                                      "owner_admin": True,
                                      "created_by": uid},
                                timeout=60)
            if not ins.ok:
                say("     [실패] %s — %s" % (n, ins.text[:160]))
                continue
            done.add(n)
            ok += 1
            total_new += 1
            say("     (%d/%d) %s" % (i, len(todo), n))

        state["올린사진"] = sorted(done)
        state["앨범이름"] = shown
        save_json(mark, state)
        say("     %d장 올렸습니다." % ok)

    try:
        os.remove(lock)
    except Exception:
        pass
    if AUTO and not total_new:
        return                       # 새 사진이 없으면 조용히 끝냅니다
    say()
    say("=" * 58)
    if total_new:
        say("  모두 %d장을 올렸습니다." % total_new)
        say("  사진첩에서 확인해 주세요 : https://skyish.kr/gallery.html")
    else:
        say("  새로 올릴 사진이 없었습니다.")
    say("=" * 58)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        say(); say("  멈췄습니다.")
    except Exception as e:
        say(); say("  뜻밖의 일이 생겼습니다 :", e)
    if not AUTO:
        input("\n창을 닫으려면 Enter 를 누르세요...")
