# -*- coding: utf-8 -*-
"""
건축상 수상자 목록 — build.py 가 불러 씁니다.

  건축가에게 주는 상 (Gallery › Architects)
    프리츠커 건축상 · RIBA 로열 골드 메달 · AIA 골드 메달 · 세계문화상(프레미엄 임페리얼) 건축 부문 · 알바르 알토 메달
  건축물에 주는 상 (Gallery › Architecture)
    RIBA 스털링상 · 미스 반 데어 로에상(EU 현대건축상) · 아가 칸 건축상 · AIA 25년상

  수상 연도 · 수상자는 기억으로 적지 않고 위키데이터(SPARQL)와 영문 위키백과 표에서 읽어 옵니다.
"""
import re, json, html, unicodedata, urllib.parse
from html.parser import HTMLParser

ARCHITECT_AWARDS = [
 {"id": "pritzker", "ko": "프리츠커 건축상", "en": "Pritzker Architecture Prize", "since": 1979,
  "by": "하얏트 재단 (미국 프리츠커 가문)", "wiki": "Pritzker Architecture Prize", "how": ("wd", "Q133160"),
  "about": "\"건축계의 노벨상\". 살아 있는 건축가 한 명(또는 팀)에게 해마다 줍니다. 상금 10만 달러와 청동 메달."},
 {"id": "rgm", "ko": "RIBA 로열 골드 메달", "en": "Royal Gold Medal", "since": 1848,
  "by": "영국 왕립건축가협회(RIBA) · 영국 국왕", "wiki": "Royal Gold Medal", "how": ("rgm",),
  "about": "1848년부터 이어진 가장 오래된 건축가 상. 국왕의 재가를 받아 평생의 업적에 줍니다."},
 {"id": "aia", "ko": "AIA 골드 메달", "en": "AIA Gold Medal", "since": 1907,
  "by": "미국건축가협회(AIA)", "wiki": "AIA Gold Medal", "how": ("aia",),
  "about": "AIA 의 최고 영예. 건축의 이론과 실천에 오래 영향을 준 업적에 줍니다."},
 {"id": "praemium", "ko": "세계문화상 (프레미엄 임페리얼) 건축 부문", "en": "Praemium Imperiale — Architecture", "since": 1989,
  "by": "일본미술협회 (후지산케이 그룹)", "wiki": "Praemium Imperiale", "how": ("praemium",),
  "about": "회화 · 조각 · 건축 · 음악 · 연극/영화 다섯 부문의 \"예술의 노벨상\". 건축 부문 수상자만 모았습니다."},
 {"id": "aalto", "ko": "알바르 알토 메달", "en": "Alvar Aalto Medal", "since": 1967,
  "by": "핀란드건축가협회 · 알바르 알토 재단", "wiki": "Alvar Aalto Medal", "how": ("wd", "Q448315"),
  "about": "창의적 건축에 몇 해에 한 번 주는 상. 인간적인 건축이라는 알토의 정신을 기립니다."},
]
BUILDING_AWARDS = [
 {"id": "stirling", "ko": "RIBA 스털링상", "en": "RIBA Stirling Prize", "since": 1996,
  "by": "영국 왕립건축가협회(RIBA)", "wiki": "Stirling Prize", "how": ("stirling",),
  "about": "그해 영국 건축 발전에 가장 크게 이바지한 건물에 줍니다 (1987~95 년은 전신 「올해의 건물」)."},
 {"id": "mies", "ko": "미스 반 데어 로에상 (EU 현대건축상)", "en": "EU Prize for Contemporary Architecture – Mies van der Rohe Award", "since": 1988,
  "by": "유럽연합 · 미스 반 데어 로에 재단 (바르셀로나)", "wiki": "Mies van der Rohe Award", "how": ("mies",),
  "about": "2년마다 유럽에서 완공된 가장 뛰어난 건축물 하나에 줍니다."},
 {"id": "agakhan", "ko": "아가 칸 건축상", "en": "Aga Khan Award for Architecture", "since": 1980,
  "by": "아가 칸 문화신탁 (AKDN)", "wiki": "Aga Khan Award for Architecture", "how": ("agakhan",),
  "about": "3년마다 무슬림 사회의 삶을 낫게 한 건축 · 재생 · 보존 · 조경 프로젝트 여러 곳에 줍니다."},
 {"id": "aia25", "ko": "AIA 25년상", "en": "AIA Twenty-five Year Award", "since": 1969,
  "by": "미국건축가협회(AIA)", "wiki": "Twenty-five Year Award", "how": ("aia25",),
  "about": "지은 지 25~35년이 지나도 여전히 빛나는, 세월의 시험을 견딘 건물에 줍니다."},
]


def fold(s):
    """비교용 — 악센트 · 대소문자 · 기호를 지웁니다"""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def txt(s):
    s = re.sub(r"<sup.*?</sup>", "", s or "", flags=re.S)
    s = re.sub(r"<style.*?</style>", "", s, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def links(s):
    return [urllib.parse.unquote(u).replace("_", " ") for u in re.findall(r'href="/wiki/([^"#:]+)"', s or "")]


class _Tables(HTMLParser):
    """위키백과 wikitable → 칸 글자 · 칸 안 링크 (rowspan/colspan 풀어 줌)"""
    def __init__(s):
        super().__init__(); s.tables = []; s.depth = 0; s.row = None; s.cell = None; s.skip = 0
    def handle_starttag(s, t, a):
        a = dict(a)
        if t == "table" and "wikitable" in (a.get("class") or ""):
            s.tables.append([]); s.depth += 1; return
        if not s.depth: return
        if t in ("sup", "style"): s.skip += 1
        if t == "tr": s.row = []
        if t in ("td", "th") and s.row is not None:
            n = lambda k: int(re.sub(r"\D", "", a.get(k, "1")) or 1)
            s.cell = {"t": "", "links": [], "rs": n("rowspan"), "cs": n("colspan")}
        if t == "a" and s.cell is not None and not s.skip and a.get("href", "").startswith("/wiki/") and ":" not in a["href"]:
            s.cell["links"].append(urllib.parse.unquote(a["href"][6:]).replace("_", " "))
        if t == "br" and s.cell is not None: s.cell["t"] += " "
    def handle_endtag(s, t):
        if not s.depth: return
        if t in ("sup", "style") and s.skip: s.skip -= 1
        if t in ("td", "th") and s.cell is not None:
            s.cell["t"] = re.sub(r"\s+", " ", s.cell["t"]).strip(); s.row.append(s.cell); s.cell = None
        if t == "tr" and s.row is not None: s.tables[-1].append(s.row); s.row = None
        if t == "table": s.depth -= 1
    def handle_data(s, d):
        if s.cell is not None and not s.skip: s.cell["t"] += d


def tables(page):
    p = _Tables(); p.feed(page)
    out = []
    for tb in p.tables:
        grid, carry = [], {}
        for r in tb:
            row, ci, k = [], 0, 0
            while k < len(r) or ci in carry:
                if ci in carry:
                    c, n = carry[ci]; row.append(c)
                    if n > 1: carry[ci] = (c, n - 1)
                    else: del carry[ci]
                    ci += 1; continue
                c = r[k]; k += 1
                for _ in range(c["cs"]):
                    row.append(c)
                    if c["rs"] > 1: carry[ci] = (c, c["rs"] - 1)
                    ci += 1
            grid.append(row)
        out.append(grid)
    return out


def collect(get):
    """get(url) → json (build.py 의 캐시 쓰는 함수). 상마다 rows 를 채워 돌려줍니다."""
    def page(title):
        u = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "parse", "format": "json", "page": title, "prop": "text", "redirects": 1})
        return ((get(u).get("parse") or {}).get("text") or {}).get("*", "")

    def wd(q):
        sp = """SELECT ?x ?xLabel ?ko ?y ?art WHERE { ?x p:P166 ?s. ?s ps:P166 wd:%s.
          OPTIONAL { ?s pq:P585 ?t. BIND(YEAR(?t) AS ?y) }
          OPTIONAL { ?x rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
          OPTIONAL { ?art schema:about ?x; schema:isPartOf <https://en.wikipedia.org/> }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }""" % q
        r = get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(sp))
        rows = {}
        for b in (r.get("results") or {}).get("bindings", []):
            if "y" not in b: continue
            name = b["xLabel"]["value"]
            art = urllib.parse.unquote(b.get("art", {}).get("value", "").rsplit("/", 1)[-1]).replace("_", " ")
            key = (b["y"]["value"], name)
            rows[key] = {"y": int(b["y"]["value"]), "who": name, "ko": b.get("ko", {}).get("value", ""),
                         "links": [art] if art else []}
        return sorted(rows.values(), key=lambda r: (-r["y"], r["who"]))

    def rgm():
        rows = []
        for g in tables(page("Royal Gold Medal")):
            for r in g[1:]:
                if len(r) >= 2 and re.match(r"\d{4}", r[0]["t"]):
                    rows.append({"y": int(r[0]["t"][:4]), "who": r[1]["t"], "links": r[1]["links"],
                                 "nat": r[2]["t"] if len(r) > 2 else ""})
        return rows

    def aia():
        h = page("AIA Gold Medal")
        rows = []
        for li in re.findall(r"<li>(.*?)</li>", h, re.S):
            m = re.match(r"\s*(\d{4})\s*:\s*(.*)", txt(li))
            if m:
                who = re.sub(r"\s*\(([^)]*)\)\s*$", "", m.group(2))
                nat = re.search(r"\(([^)]*)\)\s*$", m.group(2))
                rows.append({"y": int(m.group(1)), "who": who, "links": links(li), "nat": nat.group(1) if nat else ""})
        return rows

    def praemium():
        rows = []
        for g in tables(page("Praemium Imperiale")):
            hdr = [c["t"] for c in g[0]]
            if "Architecture" not in hdr: continue
            i = hdr.index("Architecture")
            for r in g[1:]:
                if len(r) > i and re.match(r"\d{4}", r[0]["t"]) and r[i]["t"]:
                    rows.append({"y": int(r[0]["t"][:4]), "who": r[i]["t"], "links": r[i]["links"]})
        return sorted(rows, key=lambda r: -r["y"])

    def stirling():
        rows = []
        for g in tables(page("Stirling Prize")):
            hdr = [c["t"] for c in g[0]]
            if "Laureate" not in hdr: continue
            iw = max(i for i, h in enumerate(hdr) if h.startswith("Winning work"))
            for r in g[1:]:
                if len(r) > iw and re.match(r"\d{4}", r[0]["t"]):
                    work = r[iw]["t"]
                    rows.append({"y": int(r[0]["t"][:4]), "who": r[1]["t"], "links": r[1]["links"],
                                 "work": work, "wlinks": r[iw]["links"],
                                 "note": "전신 「올해의 건물」" if int(r[0]["t"][:4]) < 1996 else ""})
        return sorted(rows, key=lambda r: -r["y"])

    def mies():
        rows = []
        g = tables(page("Mies van der Rohe Award"))
        for r in (g[0] if g else [])[1:]:
            if len(r) < 2 or not re.match(r"\d{4}", r[0]["t"]): continue
            t = r[1]["t"]
            work, _, rest = t.partition("Architect(s):")
            who = re.split(r"\s+Other\b", rest)[0].strip()
            ls = [l for l in r[1]["links"] if not l.startswith("File")]
            rows.append({"y": int(r[0]["t"][:4]), "who": who, "links": ls, "work": work.strip(), "wlinks": ls[:1]})
        return sorted(rows, key=lambda r: -r["y"])

    def aia25():
        rows = []
        for g in tables(page("Twenty-five Year Award")):
            hdr = [c["t"] for c in g[0]]
            if not any(h.startswith("Architect") for h in hdr): continue
            ia = next(i for i, h in enumerate(hdr) if h.startswith("Architect"))
            for r in g[1:]:
                if len(r) > ia and re.match(r"\d{4}", r[0]["t"]):
                    rows.append({"y": int(r[0]["t"][:4]), "who": r[ia]["t"], "links": r[ia]["links"],
                                 "work": r[1]["t"], "wlinks": r[1]["links"][:1]})
        return sorted(rows, key=lambda r: -r["y"])

    def agakhan():
        h = page("Aga Khan Award for Architecture")
        rows = []
        parts = re.split(r'<h3[^>]*>(.*?)</h3>', h)
        for i in range(1, len(parts) - 1, 2):
            m = re.search(r"\((\d{4})[–-](\d{4})\)", txt(parts[i]))
            if not m: continue
            y = int(m.group(2))
            body = parts[i + 1].split("<h2")[0]
            for li in re.findall(r"<li>(.*?)</li>", body, re.S):
                t = txt(li)
                if not t: continue
                ext = re.search(r'class="external text" href="([^"]+)"', li)
                rows.append({"y": y, "who": "", "links": [], "work": t, "wlinks": links(li)[:1],
                             "url": html.unescape(ext.group(1)) if ext else ""})
        return sorted(rows, key=lambda r: -r["y"])

    fns = {"rgm": rgm, "aia": aia, "praemium": praemium, "stirling": stirling, "mies": mies,
           "aia25": aia25, "agakhan": agakhan}
    out = {}
    for a in ARCHITECT_AWARDS + BUILDING_AWARDS:
        how = a["how"]
        try:
            rows = wd(how[1]) if how[0] == "wd" else fns[how[0]]()
        except Exception as e:
            print("   상 목록 못 읽음:", a["id"], e); rows = []
        out[a["id"]] = dict({k: v for k, v in a.items() if k != "how"}, rows=rows)
        print("   %-9s %3d건" % (a["id"], len(rows)))
    return out
