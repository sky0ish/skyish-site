# -*- coding: utf-8 -*-
"""
최신뉴스 모으기 — Contact 「최신뉴스」 갈래가 읽는 assets/data/news/*.json 을 만듭니다.

  갈래와 출처
    ai      GeekNews(news.hada.io) 가운데 AI 관련 글 — 최근 2년
    arch    대한건축사협회 건축뉴스(kira.or.kr) · ArchDaily — 최근 1년
    city    한국도시정비신문(citynews.co.kr) · 국토연구원 세계도시사례 ·
            대한국토·도시계획학회 국토·도시계획 10대 뉴스
    estate  네이버 뉴스 검색 API 「부동산」 — 최근 1년
            (fin.land.naver.com 은 프로그램 접근을 막아, 네이버 공식 API 로 받습니다.
             키가 있어야 합니다: 환경변수 NAVER_CLIENT_ID · NAVER_CLIENT_SECRET)

  쓰는 법
    python tools/news/collect.py            매일 — 새 글만 더합니다
    python tools/news/collect.py --처음     처음 한 번 — 지난 글을 기간만큼 거슬러 받습니다
    python tools/news/collect.py --only ai  한 갈래만

  · 받아 둔 것에 **더해 가며** 쌓습니다 (주소가 같으면 한 번만). 기간이 지난 것은 버립니다.
  · 제목·날짜·출처·주소(+GeekNews 는 한 줄 요약)만 담습니다. 본문은 가져오지 않습니다.
  · 사이트마다 1초 넘게 쉬어 가며 부릅니다.
"""
import io, os, re, sys, json, time, html, gzip, datetime, urllib.request, urllib.parse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "data", "news")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/128.0 Safari/537.36 skyish.kr-news/1.0")
TODAY = datetime.date.today()
FIRST = "--처음" in sys.argv
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else ""

# 갈래마다 담아 둘 기간(일)과 출처당 많아야 몇 건
KEEP = {"ai": (730, 4000), "arch": (365, 2000), "city": (3650, 400), "estate": (365, 600)}
NAMES = {"ai": "AI", "arch": "건축", "city": "도시", "estate": "부동산"}

_last = {}


def get(url, data=None, headers=None, pause=1.2):
    """같은 사이트는 pause 초 쉬었다 부릅니다"""
    host = urllib.parse.urlparse(url).netloc
    wait = _last.get(host, 0) + pause - time.time()
    if wait > 0:
        time.sleep(wait)
    h = {"User-Agent": UA, "Accept-Language": "ko,en;q=0.8", "Accept-Encoding": "gzip"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            cs = r.headers.get_content_charset() or "utf-8"
    finally:
        _last[host] = time.time()
    return raw.decode(cs, errors="replace")


def clean(s):
    s = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", s or "", flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def day(s):
    """여러 꼴의 날짜를 YYYY-MM-DD 로"""
    s = (s or "").strip()
    m = re.search(r"(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})", s)
    if m:
        return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3)))
    try:   # RSS 의 「Fri, 02 Oct 2026 17:00:00 +0000」
        from email.utils import parsedate_to_datetime
        d = parsedate_to_datetime(s)
        return d.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d")
    except Exception:
        return ""


def item(t, u, d, src, s=""):
    t = clean(t)
    if not t or not u or not d:
        return None
    o = {"t": t[:200], "u": u, "d": d, "src": src}
    if s:
        s = clean(s)
        o["s"] = s[:140] + ("…" if len(s) > 140 else "")
    return o


# ── AI — GeekNews ───────────────────────────────────────────
AI_RE = re.compile(
    r"(\bAI\b|A\.I\.|인공지능|LLM|GPT|ChatGPT|Claude|클로드|Gemini|제미나이|OpenAI|오픈AI|Anthropic|앤트로픽|"
    r"딥러닝|머신러닝|머신 러닝|기계학습|신경망|생성형|에이전트|Agent|MCP\b|RAG\b|트랜스포머|Transformer|"
    r"Llama|라마\b|Mistral|DeepSeek|딥시크|Qwen|Copilot|코파일럿|Cursor|챗봇|chatbot|파인튜닝|fine-?tun|"
    r"임베딩|embedding|추론 모델|언어 ?모델|멀티모달|Stable Diffusion|Midjourney|Sora|바이브 코딩|vibe coding|"
    r"Hugging ?Face|허깅페이스|프롬프트|prompt|NVIDIA|엔비디아|GPU)", re.I)


def hada_rows(page):
    out = []
    for blk in re.findall(r"<div class='topic_row'.*?(?=<div class='topic_row'|<div class='next|$)", page, re.S):
        t = re.search(r"<h2 class='topic-title-heading'>(.*?)</h2>", blk, re.S)
        tid = re.search(r"topic\?id=(\d+)", blk)
        dt = re.search(r'data-date="([\d-]+)"', blk)
        ds = re.search(r"<div class='topicdesc'><a[^>]*>(.*?)</a>", blk, re.S)
        if t and tid and dt:
            out.append(item(t.group(1), "https://news.hada.io/topic?id=" + tid.group(1),
                            dt.group(1), "GeekNews", ds.group(1) if ds else ""))
    return [x for x in out if x]


def geeknews():
    got = []
    # ① RSS — 가장 새 글 50
    x = get("https://news.hada.io/rss/news")
    for e in re.findall(r"<entry>(.*?)</entry>", x, re.S):
        t = re.search(r"<title>(.*?)</title>", e, re.S)
        u = re.search(r"<link[^>]*href='([^']+)'", e)
        d = re.search(r"<published>(.*?)</published>", e)
        c = re.search(r"<content[^>]*>(.*?)</content>", e, re.S)
        if t and u and d:
            got.append(item(t.group(1), u.group(1), day(d.group(1)), "GeekNews", c.group(1) if c else ""))
    # ② 날마다 — past?day=YYYY-MM-DD (처음엔 2년, 평소엔 사흘)
    n = KEEP["ai"][0] if FIRST else 3
    for i in range(n):
        d = (TODAY - datetime.timedelta(days=i)).isoformat()
        try:
            got += hada_rows(get("https://news.hada.io/past?day=" + d, pause=1.0))
        except Exception as e:
            print("   GeekNews", d, "—", e)
        if FIRST and i % 30 == 0:
            print("   GeekNews …", d)
    got = [g for g in got if g and AI_RE.search(g["t"] + " " + g.get("s", ""))]
    return got


# ── 건축 ────────────────────────────────────────────────────
def kira():
    got, lo = [], (TODAY - datetime.timedelta(days=KEEP["arch"][0])).isoformat()
    for p in range(1, 80 if FIRST else 3):
        x = get("https://www.kira.or.kr/jsp/main/01/04_03.jsp?page=%d" % p)
        rows = re.findall(r"<tr>\s*<td>\d+</td>(.*?)</tr>", x, re.S)
        if not rows:
            break
        old = False
        for r in rows:
            u = re.search(r'href="([^"]+)"', r)
            t = re.search(r'class="ellipsis_text">(.*?)</a>', r, re.S)
            m = re.findall(r'<div class="ellipsis_text"[^>]*>(.*?)</div>', r, re.S)
            d = re.search(r"<td>(20\d\d-\d\d-\d\d)</td>", r)
            if u and t and d:
                src = "건축사협회 · " + clean(m[-1]) if m else "대한건축사협회"
                got.append(item(t.group(1), html.unescape(u.group(1)), d.group(1), src))
                old = old or d.group(1) < lo
        if old:
            break
    return [g for g in got if g]


def archdaily():
    got, lo = [], (TODAY - datetime.timedelta(days=KEEP["arch"][0])).isoformat()
    x = get("https://www.archdaily.com/feed")
    for it in re.findall(r"<item>(.*?)</item>", x, re.S):
        t = re.search(r"<title>(.*?)</title>", it, re.S)
        u = re.search(r"<link>(.*?)</link>", it, re.S)
        d = re.search(r"<pubDate>(.*?)</pubDate>", it)
        c = re.search(r"<category>(.*?)</category>", it, re.S)
        if t and u and d:
            got.append(item(t.group(1), u.group(1).strip(), day(d.group(1)),
                            "ArchDaily" + (" · " + clean(c.group(1)) if c else "")))
    for p in range(2, 420 if FIRST else 4):
        x = get("https://www.archdaily.com/page/%d" % p, pause=1.5)
        arts = re.findall(r"<h3[^>]*>\s*<a[^>]*href=[\"'](/\d{6,8}/[^\"']+)[\"'][^>]*>(.*?)</a>\s*</h3>"
                          r"\s*<meta content='([\d-]+)' itemprop='datePublished'", x, re.S)
        if not arts:
            break
        for u, t, d in arts:
            got.append(item(t, "https://www.archdaily.com" + u, d, "ArchDaily"))
        if FIRST and p % 25 == 0:
            print("   ArchDaily …", p, arts[-1][2])
        if arts[-1][2] < lo:
            break
    return [g for g in got if g]


# ── 도시 ────────────────────────────────────────────────────
def citynews():
    got = []
    x = get("https://citynews.co.kr/rss/news.xml")
    for it in re.findall(r"<item>(.*?)</item>", x, re.S):
        t = re.search(r"<title>(.*?)</title>", it, re.S)
        u = re.search(r"<link>(.*?)</link>", it, re.S)
        d = re.search(r"<pubDate>(.*?)</pubDate>", it)
        if t and u and d:
            got.append(item(t.group(1), clean(u.group(1)), day(d.group(1)), "한국도시정비신문"))
    x = get("https://citynews.co.kr/news-sitemap.xml")
    for u, d, t in re.findall(r"<loc>(.*?)</loc>.*?<news:publication_date>(.*?)</news:publication_date>"
                              r".*?<news:title>(.*?)</news:title>", x, re.S):
        got.append(item(t, u.strip(), day(d), "한국도시정비신문"))
    return [g for g in got if g]


def krihs():
    got = []
    for p in range(1, 4):
        x = get("https://www.krihs.re.kr/ubinBoardList.es?mid=a60101000000&ub_id=U01&nPage=%d" % p)
        for u, t, d in re.findall(r'<a href="(/ubinBoardView\.es\?[^"]+)"[^>]*title="([^"]+)".*?'
                                  r'<dd class="date">(20\d\d-\d\d-\d\d)', x, re.S):
            got.append(item(t, "https://www.krihs.re.kr" + html.unescape(u), d, "국토연구원 세계도시사례"))
    return [g for g in got if g]


def kpa():
    """대한국토·도시계획학회 「국토·도시계획 10대 뉴스」 — 해마다 한 번"""
    got = []
    x = get("https://kpa1959.or.kr/?menuno=33")
    title = re.search(r"<title>(.*?)</title>", x, re.S)
    when = re.search(r"설문기간</th>\s*<td><div[^>]*>(20\d\d-\d\d-\d\d)", x)
    yr = re.search(r"(20\d\d)", clean(title.group(1)) if title else "")
    d = when.group(1) if when else (TODAY.isoformat())
    for t, body in re.findall(r"<dt[^>]*><a href=\"#none\">(.*?)</a></dt>\s*<dd>(.*?)</dd>", x, re.S):
        u = re.search(r'<a href="(https?://[^"]+)"[^>]*>기사보기', body)
        s = clean(body.split("<hr")[0])
        got.append(item(t, u.group(1) if u else "https://kpa1959.or.kr/?menuno=33", d,
                        "도시계획학회 10대 뉴스", s))
    return [g for g in got if g]


# ── 부동산 — 네이버 뉴스 검색 API ───────────────────────────
def naver_estate():
    cid, sec = os.environ.get("NAVER_CLIENT_ID"), os.environ.get("NAVER_CLIENT_SECRET")
    if not (cid and sec):
        raise RuntimeError("준비 중입니다 (네이버 검색 API 키를 넣으면 채워집니다)")
    got = []
    for q in ("부동산", "아파트 분양", "주택시장"):
        for start in (1, 101) if FIRST else (1,):
            x = get("https://openapi.naver.com/v1/search/news.json?sort=date&display=100&start=%d&query=%s"
                    % (start, urllib.parse.quote(q)),
                    headers={"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": sec}, pause=0.3)
            for it in json.loads(x).get("items", []):
                u = it.get("originallink") or it.get("link")
                got.append(item(it.get("title"), u, day(it.get("pubDate")), "네이버 뉴스 · " + q,
                                it.get("description")))
    return [g for g in got if g]


SOURCES = {
    "ai":     [("GeekNews", "https://news.hada.io/", geeknews)],
    "arch":   [("대한건축사협회 건축뉴스", "https://www.kira.or.kr/jsp/main/01/04_03.jsp", kira),
               ("ArchDaily", "https://www.archdaily.com/", archdaily)],
    "city":   [("한국도시정비신문", "https://citynews.co.kr/", citynews),
               ("국토연구원 세계도시사례", "https://www.krihs.re.kr/ubinBoardList.es?mid=a60101000000&ub_id=U01", krihs),
               ("도시계획학회 10대 뉴스", "https://kpa1959.or.kr/?menuno=33", kpa)],
    "estate": [("네이버 부동산 뉴스", "https://fin.land.naver.com/news", naver_estate)],
}


def load(cat):
    p = os.path.join(OUT, cat + ".json")
    try:
        return json.load(io.open(p, encoding="utf-8"))
    except Exception:
        return {"items": []}


def main():
    os.makedirs(OUT, exist_ok=True)
    for cat, srcs in SOURCES.items():
        if ONLY and cat != ONLY:
            continue
        print("■", NAMES[cat])
        old = load(cat)
        lo = (TODAY - datetime.timedelta(days=KEEP[cat][0])).isoformat()
        cap = KEEP[cat][1]
        byurl = {x["u"]: x for x in old.get("items", [])}
        report = []
        for name, home, fn in srcs:
            try:
                new = fn()
                for x in new:
                    x["k"] = name                     # 어느 출처에서 왔나 (갈래 안 거르기 단추)
                    byurl[x["u"]] = {**byurl.get(x["u"], {}), **x}
                report.append({"name": name, "url": home, "ok": True, "got": len(new)})
                print("   %s — %d건" % (name, len(new)))
            except Exception as e:
                prev = next((r for r in old.get("sources", []) if r.get("name") == name), {})
                report.append({"name": name, "url": home, "ok": False, "why": str(e)[:160],
                               "last_ok": prev.get("last_ok", "")})
                print("   %s — 못 받음: %s" % (name, e))
        items = [x for x in byurl.values() if x.get("d", "") >= lo and x.get("d", "") <= TODAY.isoformat()]
        items.sort(key=lambda x: (x["d"], x["t"]), reverse=True)
        # 출처마다 많아야 cap 건
        per, keep = {}, []
        for x in items:
            k = x.get("k", "")
            per[k] = per.get(k, 0) + 1
            if per[k] <= cap:
                keep.append(x)
        for r in report:
            r["count"] = sum(1 for x in keep if x.get("k") == r["name"])
            if r["ok"]:
                r["last_ok"] = TODAY.isoformat()
        doc = {"cat": cat, "name": NAMES[cat], "updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
               "days": KEEP[cat][0], "sources": report, "items": keep}
        io.open(os.path.join(OUT, cat + ".json"), "w", encoding="utf-8", newline="\n").write(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        print("   → %s.json  %d건" % (cat, len(keep)))


if __name__ == "__main__":
    main()
