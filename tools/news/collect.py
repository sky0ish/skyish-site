# -*- coding: utf-8 -*-
"""
최신뉴스 모으기 — Contact 「최신뉴스」 갈래가 읽는 assets/data/news/*.json 을 만듭니다.

  갈래와 출처
    ai      GeekNews(news.hada.io) 가운데 AI 관련 글 · 테크월드뉴스(epnc.co.kr) AI 갈래 — 최근 2년
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
    python tools/news/collect.py --처음 --src 테크월드뉴스  출처 하나만 (새로 더한 출처의 지난 글 받기)

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
SRC = sys.argv[sys.argv.index("--src") + 1] if "--src" in sys.argv else ""   # 출처 하나만 (나머지는 받아 둔 것 그대로)

# 갈래마다 담아 둘 기간(일)과 출처당 많아야 몇 건
KEEP = {"ai": (730, 8000), "arch": (365, 2000), "city": (3650, 400), "estate": (365, 600)}
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


def epnc():
    """테크월드뉴스 AI 갈래(S1N32) — 갈래 자체가 AI 라 낱말로 거르지 않습니다.
       날짜는 올해 것은 「10-02 17:18」, 지난해부터는 「2024-06-18」 꼴입니다."""
    got, lo = [], (TODAY - datetime.timedelta(days=KEEP["ai"][0])).isoformat()
    for p in range(1, 220 if FIRST else 3):
        x = get("https://www.epnc.co.kr/news/articleList.html?page=%d&sc_section_code=S1N32&view_type=sm" % p)
        rows = re.findall(r'<li class="altlist-webzine-item">(.*?)</li>\s*(?=<li class="altlist-webzine-item">|</ul>)', x, re.S)
        if not rows:
            break
        last = ""
        for r in rows:
            a = re.search(r'<H2 class="altlist-subject">\s*<a href="([^"]+)"[^>]*>(.*?)</a>', r, re.S | re.I)
            sm = re.search(r'<p class="altlist-summary">(.*?)</p>', r, re.S)
            ds = [v.strip() for v in re.findall(r'<div class="altlist-info-item">([^<]*)</div>', r)]
            d = ""
            for v in ds:
                m = re.match(r"(20\d\d)-(\d\d)-(\d\d)", v) or None
                if m:
                    d = m.group(0); break
                m = re.match(r"(\d\d)-(\d\d) \d\d:\d\d", v)
                if m:
                    yy = TODAY.year if "%s-%s" % m.groups() <= TODAY.strftime("%m-%d") else TODAY.year - 1
                    d = "%d-%s-%s" % (yy, m.group(1), m.group(2)); break
            if a and d:
                summ = re.sub(r"^\[테크월드=[^\]]*\]\s*", "", clean(sm.group(1))) if sm else ""
                got.append(item(a.group(2), a.group(1), d, "테크월드뉴스", summ))
                last = d
        if FIRST and p % 25 == 0:
            print("   테크월드 …", p, last)
        if last and last < lo:
            break
    return [g for g in got if g]


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


# ── ArchDaily 는 이름난 건축가 · 사무소의 작품만 ──────────────
#  「프리츠커상을 받았거나, 세계적으로 이름이 있는 유명한 건축가나 회사들의 작품들만 …
#    나머지는 삭제해줘」 — 제목(「작품 / 설계자」)이나 기사에 이 이름이 있어야 남깁니다.
PRITZKER = [
    "Philip Johnson", "Luis Barragán", "Luis Barragan", "James Stirling", "Kevin Roche", "I. M. Pei", "I.M. Pei",
    "Pei Cobb Freed", "Richard Meier", "Hans Hollein", "Gottfried Böhm", "Kenzo Tange", "Gordon Bunshaft",
    "Oscar Niemeyer", "Frank Gehry", "Gehry Partners", "Aldo Rossi", "Robert Venturi", "Álvaro Siza", "Alvaro Siza",
    "Fumihiko Maki", "Maki and Associates", "Christian de Portzamparc", "Tadao Ando", "Rafael Moneo",
    "Sverre Fehn", "Renzo Piano", "RPBW", "Norman Foster", "Foster + Partners", "Foster+Partners",
    "Rem Koolhaas", "OMA", "Jørn Utzon", "Jorn Utzon", "Glenn Murcutt", "Herzog & de Meuron", "Herzog de Meuron",
    "Zaha Hadid", "Thom Mayne", "Morphosis", "Paulo Mendes da Rocha", "Richard Rogers", "Rogers Stirk Harbour",
    "RSHP", "Jean Nouvel", "Peter Zumthor", "SANAA", "Kazuyo Sejima", "Ryue Nishizawa", "Souto de Moura",
    "Wang Shu", "Amateur Architecture Studio", "Toyo Ito", "Shigeru Ban", "Frei Otto", "Alejandro Aravena",
    "ELEMENTAL", "RCR Arquitectes", "RCR Architects", "Balkrishna Doshi", "Vastushilpa", "Arata Isozaki",
    "Grafton Architects", "Lacaton & Vassal", "Lacaton Vassal", "Francis Kéré", "Kéré Architecture",
    "Kere Architecture", "David Chipperfield", "Riken Yamamoto", "Liu Jiakun", "Jiakun Architects",
]
RENOWNED = [
    "BIG", "Bjarke Ingels", "Snøhetta", "Snohetta", "MVRDV", "Heatherwick", "Kengo Kuma", "Sou Fujimoto",
    "SOM", "Skidmore, Owings", "Diller Scofidio", "Steven Holl", "Studio Gang", "Jeanne Gang", "KPF",
    "Kohn Pedersen Fox", "UNStudio", "Ben van Berkel", "Henning Larsen", "3XN", "Safdie", "Coop Himmelb",
    "Daniel Libeskind", "Studio Libeskind", "Mecanoo", "Neri&Hu", "Neri & Hu", "MAD Architects", "Ma Yansong",
    "Aires Mateus", "Adjaye", "Junya Ishigami", "Christ & Gantenbein", "WilkinsonEyre", "Wilkinson Eyre",
    "Grimshaw", "Tatiana Bilbao", "Olson Kundig", "Bernard Tschumi", "Peter Eisenman", "Rafael Viñoly",
    "Dominique Perrault", "Mario Botta", "Santiago Calatrava", "Fuksas", "Vo Trong Nghia", "VTN Architects",
    "Sauerbruch Hutton", "Lina Ghotmeh", "Carlo Ratti", "Barozzi Veiga", "Christian Kerez", "Valerio Olgiati",
    "Smiljan Radić", "Smiljan Radic", "Gensler", "Zaha Hadid Architects", "Atelier Jean Nouvel",
    "Ateliers Jean Nouvel", "Kengo Kuma and Associates", "Kengo Kuma & Associates",
    "Thomas Heatherwick", "Bjarke", "Studio Fuksas", "Massimiliano", "Diébédo",
    "Anupama Kundoo", "Marina Tabassum", "Li Xiaodong", "Wang Shu", "Go Hasegawa", "Junya.ishigami",
    "Toshiko Mori", "Annabelle Selldorf", "Selldorf Architects", "Weiss/Manfredi", "Allied Works",
    "Brandlhuber", "Caruso St John", "6a architects", "Assemble", "Mass Design", "MASS Design",
    "Atelier Bow-Wow", "Bofill", "Ricardo Bofill", "Hassan Fathy", "Gehry", "Calatrava",
]
_famous_words = sorted(set(PRITZKER + RENOWNED), key=len, reverse=True)
# 짧은 머리글자(BIG · SOM · OMA · KPF · MAD)는 낱말로만 — 「big house」 같은 데서 잘못 걸리지 않게 대문자 그대로
_short = [w for w in _famous_words if len(w) <= 4 and w.isupper()]
_long = [w for w in _famous_words if w not in _short]
FAMOUS_RE = re.compile(r"(?:" + "|".join(re.escape(w) for w in _long) + r")", re.I)
FAMOUS_SHORT = re.compile(r"(?<![A-Za-z])(?:" + "|".join(re.escape(w) for w in _short) + r")(?![A-Za-z])")


def famous(it):
    """이름난 건축가 · 사무소의 작품(또는 그들에 관한 기사)인가"""
    t = it.get("t", "")
    return bool(FAMOUS_RE.search(t) or FAMOUS_SHORT.search(t))


# 출처마다 남길 것을 거르는 규칙 — 받아 둔 옛것에도 그대로 적용합니다 (「나머지는 삭제」)
KEEP_ONLY = {"ArchDaily": famous}


def archdaily():
    got, lo = [], (TODAY - datetime.timedelta(days=KEEP["arch"][0])).isoformat()
    x = get("https://www.archdaily.com/feed")
    for it in re.findall(r"<item>(.*?)</item>", x, re.S):
        t = re.search(r"<title>(.*?)</title>", it, re.S)
        u = re.search(r"<link>(.*?)</link>", it, re.S)
        d = re.search(r"<pubDate>(.*?)</pubDate>", it)
        c = re.search(r"<category>(.*?)</category>", it, re.S)
        if t and u and d:
            got.append(item(t.group(1), u.group(1).strip().split("?")[0], day(d.group(1)),
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
    "ai":     [("GeekNews", "https://news.hada.io/", geeknews),
               ("테크월드뉴스 AI", "https://www.epnc.co.kr/news/articleList.html?sc_section_code=S1N32&view_type=sm", epnc)],
    "arch":   [("대한건축사협회 건축뉴스", "https://www.kira.or.kr/jsp/main/01/04_03.jsp", kira),
               ("ArchDaily", "https://www.archdaily.com/", archdaily)],      # ArchDaily 는 KEEP_ONLY 로 이름난 이들만
    "city":   [("한국도시정비신문", "https://citynews.co.kr/", citynews),
               ("국토연구원 세계도시사례", "https://www.krihs.re.kr/ubinBoardList.es?mid=a60101000000&ub_id=U01", krihs),
               ("도시계획학회 10대 뉴스", "https://kpa1959.or.kr/?menuno=33", kpa)],
    "estate": [("네이버 부동산 뉴스", "https://fin.land.naver.com/news", naver_estate)],
}


FRONT = 600     # 첫 파일에 담을 최근 글 수 — 나머지는 <갈래>-old.json (요약 없이)


def load(cat):
    p = os.path.join(OUT, cat + ".json")
    try:
        doc = json.load(io.open(p, encoding="utf-8"))
    except Exception:
        return {"items": []}
    try:   # 지난 글 묶음도 함께 읽어 합칩니다
        doc["items"] = doc.get("items", []) + json.load(
            io.open(os.path.join(OUT, cat + "-old.json"), encoding="utf-8")).get("items", [])
    except Exception:
        pass
    return doc


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
            if SRC and SRC not in name:
                prev = next((r for r in old.get("sources", []) if r.get("name") == name), None)
                if prev:
                    report.append(prev)
                continue
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
        items = [x for x in items if x.get("k") not in KEEP_ONLY or KEEP_ONLY[x["k"]](x)]
        # 같은 기사가 받는 길(RSS · 목록)에 따라 주소 꼴만 달라 두 번 들어오는 일 — 출처·날짜·제목이 같으면 한 번만
        seen_t, uniq = set(), []
        for x in sorted(items, key=lambda x: len(x.get("s", "")), reverse=True):   # 요약이 있는 쪽을 남깁니다
            key = (x.get("k"), x.get("d"), x.get("t", "").strip().lower())
            if key in seen_t:
                continue
            seen_t.add(key); uniq.append(x)
        items = uniq
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
        # 화면이 빨리 뜨게 둘로 나눕니다 —
        #   <갈래>.json      최근 FRONT 건 (요약 포함) · 처음 열 때 읽음
        #   <갈래>-old.json  그 앞의 글 (제목만)      · 「더 보기」·찾기 때 읽음
        front, rest = keep[:FRONT], [{k: v for k, v in x.items() if k != "s"} for x in keep[FRONT:]]
        doc = {"cat": cat, "name": NAMES[cat], "updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
               "days": KEEP[cat][0], "sources": report, "total": len(keep), "more": len(rest),
               "items": front}
        for fn, body in ((cat + ".json", doc), (cat + "-old.json", {"items": rest})):
            io.open(os.path.join(OUT, fn), "w", encoding="utf-8", newline=chr(10)).write(
                json.dumps(body, ensure_ascii=False, separators=(",", ":")))
        print("   → %s.json  %d건" % (cat, len(keep)))


if __name__ == "__main__":
    main()
