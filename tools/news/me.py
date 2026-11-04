# -*- coding: utf-8 -*-
"""
내 이름이 나온 뉴스·유튜브 — BLOG ▸ NEWS / YOUTUBE (media.html) 가 읽는
assets/data/news/me-news.json · me-youtube.json 에 새 것을 더합니다.
날마다 아침 collect.py(최신뉴스)가 끝난 뒤 이어서 불립니다 — news.yml 은 고칠 것이 없습니다.

  「경기연구원 남지현」 만 담습니다. 같은 이름의 배우·가수·앵커는 버립니다.
    · 「남지현」 바로 앞뒤 60자 안에 경기연구원·연구위원·연구실장·센터장 같은 말이 있어야 담고
    · 배우·드라마·앵커 같은 말이 있으면 버립니다 (아래 MINE · NOT).

  출처
    뉴스    ① 네이버 뉴스 검색 API — 키가 있을 때 (환경변수 NAVER_CLIENT_ID · NAVER_CLIENT_SECRET,
              GitHub 저장소 Settings → Secrets and variables → Actions 에 넣으면 news.yml 이 넘겨 줍니다)
            ② 구글 뉴스 RSS — 키 없이. 「남지현 연구위원」 처럼 이름과 직함을 붙인 말로만 찾습니다
    유튜브  YouTube 검색 결과 (키 없이) → 영상마다 설명 전문까지 읽어 위 기준으로 확인

  · 한 번 담은 것은 지우지 않습니다 (손으로 넣은 것 "m":1 도 그대로).
  · 잘못 들어온 것은 json 의 "hide" 목록에 주소(뉴스) 또는 영상 id(유튜브)를 넣으면 다시 들어오지 않습니다.

  쓰는 법
    python tools/news/me.py              뉴스·유튜브 둘 다
    python tools/news/me.py --only news  한 갈래만 (news | youtube)
"""
import io, os, re, sys, json, datetime, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from collect import get, clean, day        # 같은 폴더의 최신뉴스 모으기와 같은 부르기·다듬기

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "data", "news")     # news.yml 이 이 폴더를 올립니다
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else ""

NAME = "남지현"
MINE = re.compile(r"(경기연구원|경기硏|경기 연구원|GRI|연구위원|연구실장|북부발전|균형발전|공간주거|도시주택|"
                  r"센터장|박사|발제|좌장|토론자|주제발표|교수)")
NOT = re.compile(r"(배우|여배우|아역|드라마|사극|가수|포미닛|4minute|아이돌|앵커|아나운서|KGMA|팬미팅|화보|"
                 r"굿파트너|은애하는|떨릴 수 있게|캐스팅|예능|시청률|#shorts)", re.I)


def about_me(*texts):
    """「남지현」 이 경기연구원 남지현을 가리키는 곳이 하나라도 있으면 True"""
    s = " ".join(clean(t) for t in texts if t)
    hit = False
    for m in re.finditer(NAME, s):
        win = s[max(0, m.start() - 60): m.end() + 60]
        if NOT.search(win):
            return False                     # 배우·앵커 쪽 글은 통째로 버립니다
        if MINE.search(win):
            hit = True
    return hit


def role_of(text):
    """「남지현 경기연구원 선임연구위원」 처럼 이름 앞뒤의 직함 한 토막"""
    s = clean(text)
    m = re.search(r"(경기연구원[^,.。\"'“”]{0,18}?)?\s*남지현\s*([^,.。\"'“”()]{0,24}?(연구위원|실장|센터장|박사))", s)
    if m:
        return re.sub(r"\s+", " ", (m.group(1) or "") + " 남지현 " + m.group(2)).strip()
    m = re.search(r"((경기연구원|경기硏)?\s*[^\s,.]{0,12}(연구위원|실장|센터장))\s*남지현", s)
    return (m.group(1).strip() + " 남지현") if m else ""


def sentence(text):
    """「남지현」 이 든 한 문장 (140자 안)"""
    s = clean(text)
    i = s.find(NAME)
    if i < 0:
        return s[:140]
    a = max(s.rfind(". ", 0, i), s.rfind("다. ", 0, i), 0)
    b = s.find(". ", i)
    out = s[a + (2 if a else 0): (b + 1) if b > 0 else len(s)].strip()
    return out[:140] + ("…" if len(out) > 140 else "")


# ── 뉴스 ① 네이버 뉴스 검색 API ─────────────────────────────
def naver():
    cid, sec = os.environ.get("NAVER_CLIENT_ID"), os.environ.get("NAVER_CLIENT_SECRET")
    if not (cid and sec):
        raise RuntimeError("키 없음 — 건너뜁니다")
    got = []
    for q in ("남지현 경기연구원", "남지현 연구위원", "남지현 선임연구위원", "남지현 균형발전센터장", "남지현 연구실장"):
        for start in (1, 101):
            x = get("https://openapi.naver.com/v1/search/news.json?sort=date&display=100&start=%d&query=%s"
                    % (start, urllib.parse.quote(q)),
                    headers={"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": sec}, pause=0.3)
            rows = json.loads(x).get("items", [])
            for it in rows:
                t, s = it.get("title", ""), it.get("description", "")
                if not about_me(t, s):
                    continue
                u = it.get("originallink") or it.get("link")
                host = urllib.parse.urlparse(u).netloc.replace("www.", "")
                o = {"t": clean(t)[:200], "u": u, "d": day(it.get("pubDate")), "src": host,
                     "s": sentence(s), "role": role_of(t + " " + s), "via": "네이버"}
                if "n.news.naver.com" in (it.get("link") or ""):
                    o["nv"] = it["link"]
                got.append(o)
            if len(rows) < 100:
                break
    return got


# ── 뉴스 ② 구글 뉴스 RSS (키 없이) ──────────────────────────
GN_Q = ['"남지현 연구위원"', '"남지현 선임연구위원"', '"남지현 경기연구원"', '"경기연구원 남지현"',
        '"남지현 북부발전연구실장"', '"남지현 균형발전센터장"', '"남지현 경기도 균형발전센터장"']


def google_news():
    got = []
    for q in GN_Q:
        x = get("https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q=" + urllib.parse.quote(q), pause=1.5)
        for e in re.findall(r"<item>(.*?)</item>", x, re.S):
            t = re.search(r"<title>(.*?)</title>", e, re.S)
            u = re.search(r"<link>(.*?)</link>", e, re.S)
            d = re.search(r"<pubDate>(.*?)</pubDate>", e, re.S)
            src = re.search(r"<source[^>]*>(.*?)</source>", e, re.S)
            if not (t and u and d):
                continue
            title = clean(t.group(1))
            outlet = clean(src.group(1)) if src else ""
            if outlet and title.endswith(" - " + outlet):
                title = title[: -len(outlet) - 3]
            if NOT.search(title):
                continue
            got.append({"t": title[:200], "u": u.group(1).strip(), "d": day(d.group(1)), "src": outlet,
                        "s": "", "role": q.strip('"'), "via": "구글뉴스"})
    return got


# ── 유튜브 ──────────────────────────────────────────────────
YT_Q = ["남지현 경기연구원", '"남지현" 연구위원', '"남지현" 선임연구위원', '"남지현" 경기연구원 토론회',
        '"남지현" 발제', '"남지현" 경기북부', '"남지현" 반환공여지', '"남지현" 균형발전', '"남지현" 경기도의회']
YT_H = {"Accept-Language": "ko-KR,ko;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI"}


def yt_json(page, var):
    """페이지 안의 var ytInitialData = {...}; 를 꺼냅니다 (raw_decode 로 끝을 정확히)"""
    i = page.find(var + " = ")
    if i < 0:
        i = page.find(var + "=")
    if i < 0:
        return {}
    j = page.find("{", i)
    try:
        return json.JSONDecoder().raw_decode(page[j:])[0]
    except Exception:
        return {}


def walk(o, out):
    if isinstance(o, dict):
        if "videoRenderer" in o:
            v = o["videoRenderer"]
            out.append(v.get("videoId"))
            return
        for x in o.values():
            walk(x, out)
    elif isinstance(o, list):
        for x in o:
            walk(x, out)


def youtube(known, checked):
    ids, answered = [], 0
    for q in YT_Q:
        for sp in ("", "&sp=CAI%253D"):          # 관련도 순 · 올린 날 순
            try:
                page = get("https://www.youtube.com/results?hl=ko&gl=KR&search_query=" + urllib.parse.quote(q) + sp,
                           headers=YT_H, pause=1.5)
                walk(yt_json(page, "ytInitialData"), ids)
                answered += 1
            except Exception as e:
                print("   검색 못 함:", q, e)
    if not answered:
        raise RuntimeError("YouTube 검색이 한 번도 답하지 않았습니다")
    got = []
    for vid in dict.fromkeys(i for i in ids if i):
        if vid in known or vid in checked:
            continue
        try:
            p = yt_json(get("https://www.youtube.com/watch?hl=ko&v=" + vid, headers=YT_H, pause=1.5),
                        "ytInitialPlayerResponse")
        except Exception as e:
            print("   영상 못 읽음:", vid, e)
            continue
        vd = p.get("videoDetails", {})
        mf = p.get("microformat", {}).get("playerMicroformatRenderer", {})
        t, desc = vd.get("title", ""), vd.get("shortDescription", "")
        checked.add(vid)                     # 한 번 읽은 영상은 다음부터 건너뜁니다
        if not about_me(t, desc):
            continue
        sec = int(vd.get("lengthSeconds") or 0)
        got.append({"id": vid, "t": t[:200], "ch": vd.get("author", ""),
                    "d": (mf.get("publishDate") or mf.get("uploadDate") or "")[:10],
                    "len": ("%d:%02d:%02d" % (sec // 3600, sec % 3600 // 60, sec % 60)) if sec >= 3600
                    else ("%d:%02d" % (sec // 60, sec % 60)),
                    "s": sentence(desc), "role": role_of(t + " " + desc)})
    return got


# ── 담기 ────────────────────────────────────────────────────
def load(fn):
    try:
        return json.load(io.open(os.path.join(OUT, fn), encoding="utf-8"))
    except Exception:
        return {"items": [], "hide": []}


def save(fn, doc, fresh=True):
    if fresh:                                # 한 곳이라도 받아 왔을 때만 「모은 때」를 고칩니다
        doc["updated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    io.open(os.path.join(OUT, fn), "w", encoding="utf-8", newline=chr(10)).write(
        json.dumps(doc, ensure_ascii=False, indent=1))


def main():
    os.makedirs(OUT, exist_ok=True)
    if ONLY in ("", "news"):
        print("■ 뉴스")
        doc = load("me-news.json")
        hide = set(doc.get("hide", []))
        have = {x["u"]: x for x in doc.get("items", [])}
        titles = {(x.get("src", ""), x.get("t", "")) for x in have.values()}
        added, ok = 0, False
        for name, fn in (("네이버", naver), ("구글뉴스", google_news)):
            try:
                rows = fn()
                ok = True
                print("   %s — %d건" % (name, len(rows)))
            except Exception as e:
                print("   %s — %s" % (name, e))
                continue
            for x in rows:
                if not x.get("d") or x["u"] in hide or x["u"] in have or (x.get("src", ""), x["t"]) in titles \
                        or any(x["t"] == y["t"] for y in have.values()):
                    continue
                have[x["u"]] = x
                titles.add((x.get("src", ""), x["t"]))
                added += 1
        doc["items"] = sorted(have.values(), key=lambda x: x.get("d", ""), reverse=True)
        save("me-news.json", doc, ok)
        print("   → me-news.json  새 %d건 · 모두 %d건" % (added, len(doc["items"])))
    if ONLY in ("", "youtube"):
        print("■ 유튜브")
        doc = load("me-youtube.json")
        hide = set(doc.get("hide", []))
        have = {x["id"]: x for x in doc.get("items", [])}
        checked = set(doc.get("checked", []))
        try:
            rows, ok = youtube(set(have) | hide, checked), True
        except Exception as e:
            print("   못 받음:", e)
            rows, ok = [], False
        for x in rows:
            if x["id"] not in hide:
                have[x["id"]] = x
        doc["items"] = sorted(have.values(), key=lambda x: x.get("d", ""), reverse=True)
        doc["checked"] = sorted(checked - set(have))[-4000:]
        save("me-youtube.json", doc, ok)
        print("   → me-youtube.json  새 %d건 · 모두 %d건" % (len(rows), len(doc["items"])))


if __name__ == "__main__":
    main()
