# -*- coding: utf-8 -*-
"""ArchDaily 의 그 건축물 프로젝트 페이지와, 그 안의 도면 · 그림 한 장 한 장의 페이지 주소를 찾습니다.

  ArchDaily 그림은 저작권이 있어 홈피에 싣지 않고, **그 그림을 바로 볼 수 있는 페이지로 이어 줍니다**.
  프로젝트 페이지의 그림 주소 끝에 그림 종류가 붙어 있습니다 (…-site-plan, …-plan-01, …-section, …-detail).

  찾은 결과는 build.py 의 cache.json 에 「ad:<id>」 로 둡니다 (프로젝트 페이지는 크기가 커서 통째로 두지 않음)."""
import io, re, json, time, html, urllib.request, urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/128.0 Safari/537.36 skyish.kr-architect-notes/1.0")

# 그림 종류 — 주소 끝말 → (갈래, 한글 이름)
KINDS = [
 (r"site-?plan|masterplan|master-plan|location-plan", "plan", "배치도"),
 (r"roof-?plan", "plan", "지붕 평면도"),
 (r"(ground|first|second|third|level|floor|basement|typical)[-a-z0-9]*-?plan|plan(-\d+)?$|plans?$", "plan", "평면도"),
 (r"section|sections|cross-section|longitudinal", "plan", "단면도"),
 (r"elevation|facade-drawing", "plan", "입면도"),
 (r"axonometric|axo|exploded|isometric", "concept", "분해도 · 액소노메트릭"),
 (r"aerial|bird|drone", "concept", "조감도"),
 (r"diagram|concept|scheme", "concept", "다이어그램"),
 (r"sketch|drawing|illustration|render", "concept", "스케치 · 드로잉"),
 (r"model|maquette", "concept", "모형"),
 (r"detail|construction|structure|structural|wall-section|facade-detail", "build", "상세도 · 구조"),
]


def fetch(url, pause=1.5):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                b = r.read().decode("utf-8", errors="replace")
            time.sleep(pause)
            return b
        except Exception:
            time.sleep(3 * (i + 1))
    return ""


def fold(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def find_project(title, firm, query=None):
    """ArchDaily 검색 API → 제목과 설계자가 가장 잘 맞는 프로젝트 하나
       (건물 이름의 주요 낱말이 절반 이상 제목에 들어 있어야 — 같은 도시 · 같은 건축가의 다른 작품을 막음)"""
    q = (query or (title + " " + firm)).strip()
    raw = fetch("https://www.archdaily.com/search/api/v1/us/projects?q=" + urllib.parse.quote(q))
    try:
        res = json.loads(raw).get("results", [])
    except Exception:
        return None
    tw = [w for w in fold(re.sub(r"\(.*?\)", "", title)).split() if len(w) > 1 and w not in ("the", "and", "for", "of", "de", "la", "le", "museum", "house", "building", "center", "centre", "hall")]
    fw = [w for w in fold(firm).split() if len(w) > 2 and w not in ("and", "architects", "architecture", "partners", "associates", "the")]
    best, score = None, 0
    for r in res[:20]:
        t = fold(r.get("title", ""))
        sc = sum(2 for w in tw if w in t) + sum(1 for w in fw if w in t)
        if sc > score:
            best, score = r, sc
    if not best or score < 2:
        return None
    bt = fold(best.get("title", "")).split(" / ")[0] if " / " in best.get("title", "") else fold(best.get("title", ""))
    hit = sum(1 for w in tw if w in bt)
    need = len(tw) if len(tw) <= 2 else -(-len(tw) * 6 // 10)   # 두 낱말 이하면 모두, 그보다 많으면 60% 이상
    if tw and hit < max(1, need):
        return None
    return {"u": best["url"].split("?")[0], "title": best.get("title", ""), "year": best.get("year")}


def looks_like_drawing(src):
    """이름표 없는 그림 — 작은 그림을 받아 흰 바탕 · 무채색이 대부분이면 도면으로 봅니다 (그림은 저장하지 않음)"""
    try:
        from PIL import Image
        req = urllib.request.Request(src, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            if int(r.headers.get("Content-Length") or 0) > 4_000_000:
                return False
            im = Image.open(io.BytesIO(r.read(4_000_000))).convert("RGB").resize((64, 64))
        px = list(im.getdata())
        white = sum(1 for (r, g, b) in px if min(r, g, b) > 225) / len(px)
        gray = sum(1 for (r, g, b) in px if max(r, g, b) - min(r, g, b) < 18) / len(px)
        return white > 0.45 or (white > 0.25 and gray > 0.8)
    except Exception:
        return False


def drawings(project_url):
    """프로젝트 페이지 → 도면 · 그림 한 장씩의 페이지 [{u, kind, label}]"""
    s = fetch(project_url)
    path = urllib.parse.urlparse(project_url).path.rstrip("/")
    links = []
    for m in re.finditer(re.escape(path) + r"/([0-9a-f]{20,})-([a-z0-9-]*)['\"][^>]*>\s*<picture>.*?<img[^>]*src='([^']+)'", s, re.S):
        u = "https://www.archdaily.com" + path + "/" + m.group(1) + "-" + m.group(2)
        if u not in [x["u"] for x in links]:
            links.append({"u": u, "slug": m.group(2), "src": html.unescape(m.group(3))})
    out = []
    for x in links:
        tail = x["slug"]
        if tail.endswith("-") or not tail:                 # 이름표 없는 그림 — 도면처럼 보이면 「도면」
            if looks_like_drawing(x["src"]):
                out.append({"u": x["u"], "kind": "plan", "label": "도면", "slug": tail[-40:]})
            continue
        # 프로젝트 이름 뒤에 붙은 그림 종류 말만
        for rx, kind, label in KINDS:
            m = re.search(r"(?:^|-)(" + rx + r")$", tail)
            if m and not tail.endswith("-photo"):
                out.append({"u": x["u"], "kind": kind, "label": label, "slug": tail[-40:]})
                break
    photos = [x["u"] for x in links if x["slug"].endswith("photo")]
    return out, photos[:1], len(links)


def collect(cache, bid, title, firm, query=None):
    key = "ad:" + bid
    if key in cache:
        return cache[key]
    p = find_project(title, firm, query)
    if not p:
        cache[key] = None
        return None
    d, ph, n = drawings(p["u"])
    p.update({"drawings": d, "photo": ph[0] if ph else "", "n": n})
    cache[key] = p
    return p


# ── ArchDaily 에 도면이 없을 때 — WikiArquitectura · 건축가 공식 페이지에서 ──
WA_KIND = [
 (r"(^|[_.-])sec([_.-]|\d|$)|_corte|corte_", "plan", "단면도"),
 (r"esq|esquema", "concept", "다이어그램"),
 (r"(^|[_.-])sop([_.-]|$)", "build", "상세도"),
 (r"empl|situaci|site|emplazamiento|implantacion|planimetria", "plan", "배치도"),
 (r"planta|plan|floor|piso|nivel|subt", "plan", "평면도"),
 (r"secci|secc|section|corte", "plan", "단면도"),
 (r"alz|elev|fachada", "plan", "입면도"),
 (r"axo|isom|explot", "concept", "분해도 · 액소노메트릭"),
 (r"maq|model", "concept", "모형"),
 (r"croq|boce|sketch|dibujo|concept|diagram|esquema", "concept", "스케치 · 다이어그램"),
 (r"det|constr|estruct|struct", "build", "상세도 · 구조"),
]


def wa_page(title):
    """WikiArquitectura (영문판) 의 그 건축물 페이지"""
    raw = fetch("https://en.wikiarquitectura.com/wp-json/wp/v2/search?per_page=5&search=" + urllib.parse.quote(title), pause=1.0)
    try:
        res = json.loads(raw)
    except Exception:
        return None
    tw = [w for w in fold(re.sub(r"\(.*?\)", "", title)).split() if len(w) > 2]
    for r in res:
        t = fold(html.unescape(r.get("title", "")))
        if r.get("subtype") == "building" and tw and sum(1 for w in tw if w in t) >= max(1, len(tw) // 2):
            return r["url"]
    return None


def page_drawings(url, only_section=None, site=""):
    """웹 페이지 안의 그림 가운데 도면처럼 보이는 것 — 그림 파일 주소로 바로 이어 줍니다"""
    s = fetch(url, pause=1.0)
    if only_section:
        i = s.find(only_section)
        if i < 0:
            return []
        s = s[i:i + 80000]
    seen, out = set(), []
    for u in re.findall(r"https?://[^\"'\s<>]+?\.(?:jpe?g|png)(?:\?[^\"'\s<>]*)?", s, re.I):
        u = html.unescape(u)
        base = u.split("?")[0]
        if "wikiarquitectura.com" in base:                                      # 워드프레스 섬네일 → 원본
            base = re.sub(r"-\d{2,4}x\d{2,4}(?=\.\w+$)", "", base)
        if base in seen or re.search(r"logo|icon|social|avatar|sprite|banner", base, re.I):
            continue
        seen.add(base)
        name = base.rsplit("/", 1)[-1].lower()
        kind, label = None, None
        for rx, k, lb in WA_KIND:
            if re.search(rx, name):
                kind, label = k, lb
                break
        if not kind:
            thumb = re.sub(r"(\.\w+)$", lambda m: "-205x205" + m.group(1), base) if "wikiarquitectura.com" in base else u
            if not looks_like_drawing(thumb):
                continue
            kind, label = "plan", "도면"
        out.append({"u": base, "kind": kind, "label": label, "site": site})
        if len(out) >= 16:
            break
    return out


def more_drawings(cache, bid, title, extra_urls=()):
    """WikiArquitectura 도면 + (있으면) 건축가 공식 페이지의 도면"""
    key = "more:" + bid
    if key in cache:
        return cache[key]
    got = []
    wa = wa_page(title)
    if wa:
        for d in page_drawings(wa, only_section='id="building-drawings"', site="WikiArquitectura"):
            got.append(d)
    for u in extra_urls:                              # "주소" · "주소|그림 주소에 꼭 든 말" · "wa:주소"(WikiArquitectura 다른 언어판)
        if u.startswith("wa:"):
            got += page_drawings(u[3:], only_section='id="building-drawings"', site="WikiArquitectura")
            continue
        u, _, hint = u.partition("|")
        site = urllib.parse.urlparse(u).netloc.replace("www.", "")
        got += [d for d in page_drawings(u, site=site) if not hint or hint in d["u"]]
    cache[key] = {"wa": wa, "drawings": got}
    return cache[key]


def image_of(cache, u):
    """그림을 홈피에 바로 보여 줄 그림 파일 주소 — ArchDaily 그림 페이지면 그 페이지의 큰 그림(og:image)"""
    if re.search(r"\.(jpe?g|png|gif|webp)(\?|$)", u, re.I):
        return u
    key = "img:" + u
    if key not in cache:
        s = fetch(u, pause=1.0)
        m = re.search(r'og:image" content="([^"]+)"', s) or re.search(r"og:image' content='([^']+)'", s)
        cache[key] = html.unescape(m.group(1)) if m else ""
    return cache[key]
