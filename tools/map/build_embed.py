# -*- coding: utf-8 -*-
"""
1_MAP 의 KMZ·KML 을 사이트에 심는 자료로 굽습니다.
  돌리는 법 :  홈피 뿌리에서   python tools/map/build_embed.py
  결과      :  assets/data/embed-maps.json

폴더 이름으로 어느 게시판에 붙을지 가립니다.
  맛집·까페·쇼핑·한식…      → 핫플(hot)
  답사지·건축·가볼만한곳    → 도시건축(urban)
  호텔·출장·여행·그 밖      → 여행(trip)
"""
import io, os, re, json, zipfile, glob, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC  = os.path.join(ROOT, "1_MAP")
OUT  = os.path.join(ROOT, "assets", "data", "embed-maps.json")

HOT   = re.compile("맛집|까페|카페|쇼핑|셔핑|한식|양식|중식|일식|BAR|태국")
URBAN = re.compile("답사|건축|가볼만한")

PALETTE = {
    "hot":   ["#d63a2f", "#e0a70a", "#8a6bb0", "#0288D1", "#4E342E"],
    "urban": ["#c85a12", "#1f3f7a", "#3f8b4a", "#7a5230", "#2b8f8f"],
    "trip":  ["#4f9d92", "#2a5fa8", "#b0468f", "#5c9e4a", "#a52714"],
}
used = {k: 0 for k in PALETTE}

def cdata(s):
    m = re.match(r"\s*<!\[CDATA\[(.*)\]\]>\s*$", s or "", re.S)
    return (m.group(1) if m else (s or "")).strip()

def kml_of(path):
    if path.lower().endswith(".kmz"):
        z = zipfile.ZipFile(path)
        entry = next(n for n in z.namelist() if n.lower().endswith(".kml"))
        return z.read(entry).decode("utf-8", "replace")
    return io.open(path, encoding="utf-8", errors="replace").read()

def style_colors(x):
    """Style id → #rrggbb  (KML 색은 aabbggrr 차례입니다)"""
    out = {}
    for m in re.finditer(r'<Style[^>]*id="([^"]+)"[^>]*>(.*?)</Style>', x, re.S):
        c = re.search(r"<color>\s*([0-9a-fA-F]{8})\s*</color>", m.group(2))
        if c:
            v = c.group(1)
            out[m.group(1)] = "#" + v[6:8] + v[4:6] + v[2:4]
    return out

def places_of(block):
    out = []
    for pm in re.finditer(r"<Placemark[^>]*>(.*?)</Placemark>", block, re.S):
        b = pm.group(1)
        nm = re.search(r"<name>(.*?)</name>", b, re.S)
        co = re.search(r"<coordinates>\s*([\-\d.]+)\s*,\s*([\-\d.]+)", b)
        if not (nm and co):
            continue
        p = {"n": cdata(nm.group(1)), "lat": round(float(co.group(2)), 6),
             "lng": round(float(co.group(1)), 6)}
        de = re.search(r"<description>(.*?)</description>", b, re.S)
        if de:
            d = re.sub(r"<[^>]+>", " ", cdata(de.group(1)))
            d = re.sub(r"\s+", " ", d).strip()[:200]
            if d:
                p["d"] = d
        out.append(p)
    return out

def grp_of(folder_name, file_stem):
    n = folder_name + " " + file_stem
    if HOT.search(folder_name):
        return "hot"
    if URBAN.search(n):
        return "urban"
    return "trip"

def color_of(block, styles, grp):
    su = re.search(r"<styleUrl>#([^<]+)</styleUrl>", block)
    if su:
        sid = su.group(1)
        for k, v in styles.items():
            if k.startswith(sid):
                return v
    c = PALETTE[grp][used[grp] % len(PALETTE[grp])]
    used[grp] += 1
    return c

# 서울 맛집 8층은 이미 사이트에서 검증된 원색을 그대로 씁니다 — 스타일 추정보다 확실합니다
SEOUL_FIX = {"한식": "#4E342E", "양식": "#0288D1", "태국&기타": "#A52714", "중식": "#E65100",
             "까페": "#FFD600", "일식": "#0F9D58", "BAR": "#303F9F", "셔핑": "#8a6bb0"}

layers, seen_keys = [], set()
for path in sorted(glob.glob(os.path.join(SRC, "*.km[lz]"))):
    stem = re.sub(r"^\d{6,8}_", "", os.path.splitext(os.path.basename(path))[0])
    stem = stem.replace("ㅡ", " ").replace("ㆍ", " ").strip()
    x = kml_of(path)
    styles = style_colors(x)
    folders = list(re.finditer(r"<Folder>(.*?)</Folder>", x, re.S))
    chunks = ([(cdata(re.search(r"<name>(.*?)</name>", f.group(1), re.S).group(1))
                if re.search(r"<name>", f.group(1)) else "", f.group(1))
               for f in folders] if folders else [("", x)])

    for fname, block in chunks:
        pls = places_of(block)
        if not pls:
            continue
        label = fname if fname and "제목없" not in fname else ""
        grp = grp_of(label, stem)
        # 서울 맛집은 층 이름 그대로, 나머지는 「부산 맛집」 처럼 지역을 앞에
        region = stem.split()[0]
        name = label if region.startswith("서울") else (region + (" " + label if label else "")).strip()
        key = re.sub(r"[^a-z0-9가-힣]+", "-", (region + "-" + (label or "all")).lower()).strip("-")
        while key in seen_keys:
            key += "x"
        seen_keys.add(key)
        color = SEOUL_FIX.get(label) if region.startswith("서울") else None
        if name == "셔핑": name = "쇼핑"          # 원본 오타를 바로잡습니다
        layers.append({"key": key, "name": name,
                       "color": color or color_of(block, styles, grp),
                       "grp": grp, "places": pls})
        print(f"  {grp:5} | {name:14} | {len(pls):3}곳 | {layers[-1]['color']}")

data = {"name": "심긴 지도", "from": "1_MAP (tools/map/build_embed.py)",
        "count": sum(len(L["places"]) for L in layers), "layers": layers}
io.open(OUT, "w", encoding="utf-8", newline="\n").write(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(f"\n→ {OUT}  층 {len(layers)} · 점 {data['count']}")
