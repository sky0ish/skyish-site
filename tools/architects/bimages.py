# -*- coding: utf-8 -*-
"""건축물 노트의 그림 — 위키미디어 공용(Commons) 분류에서 파일 이름으로 골라 갈래를 나눕니다.

  concept  조감도 · 분해도(액소노메트릭) · 컨셉 스케치 · 모형 · 다이어그램
  plan     평면도 · 입면도 · 단면도 · 배치도
  build    시공 중 · 구조 · 디테일 · 외피 · 실내

  자유 이용(Commons) 그림만 쓰고, 저작자 · 라이선스를 함께 적습니다 (build.py 의 commons_info)."""
import re, urllib.parse

KIND = [
 ("plan",    re.compile(r"(floor ?plan|\bplans?\b|grundriss|\bsection\b|\bsections\b|schnitt|elevation|ansicht|planta|alzado|coupe|site ?plan|lageplan|\bplattegrond)", re.I)),
 ("concept", re.compile(r"(aerial|from above|bird.?s.?eye|luftbild|luftaufnahme|drone|axonometr|\baxo\b|exploded|concept|sketch|skizze|model\b|modell|maquette|diagram|rendering)", re.I)),
 ("build",   re.compile(r"(construction|under construction|baustelle|\bbau\b|structur|detail|roof|dach|fa[cç]ade|fassade|interior|innen|stair|treppe|cladding|truss|ceiling|column|beam|glass|marble|brick|concrete|timber|steel|louver|louvre|lobby|foyer|\bhall\b)", re.I)),
]
SUBCAT_OK = re.compile(r"(plan|drawing|interior|construction|aerial|model|section|elevation|architect|structure|detail|roof|fa[cç]ade|inside|exterior|from above)", re.I)
SKIP = re.compile(r"(logo|map\b|locator|flag|coat of arms|\.pdf$|\.tif|\.ogv|\.webm|\.mp|\.ogg|\.wav)", re.I)


def members(get, cat, kind="file|subcat"):
    out, cont = [], {}
    for _ in range(4):
        q = {"action": "query", "format": "json", "list": "categorymembers", "cmtitle": "Category:" + cat,
             "cmtype": kind, "cmlimit": 500}
        q.update(cont)
        j = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q))
        out += (j.get("query") or {}).get("categorymembers", [])
        cont = j.get("continue") or {}
        if not cont.get("cmcontinue"):
            break
        cont = {"cmcontinue": cont["cmcontinue"]}
    return out


def pick(get, info, cat, per=3):
    """분류(와 이름이 맞는 하위 분류 두 단계)에서 갈래마다 per 장"""
    files, seen_c = [], set()
    def walk(c, depth, hint):
        if c in seen_c or len(seen_c) > 40:
            return
        seen_c.add(c)
        for m in members(get, c):
            t = m.get("title", "")
            if t.startswith("File:"):
                if not SKIP.search(t):
                    files.append((t[5:], hint))
            elif t.startswith("Category:") and depth < 2:
                sub = t[9:]
                if SUBCAT_OK.search(sub):
                    walk(sub, depth + 1, (hint + " " + sub).strip())
    walk(cat, 0, "")
    got = {"concept": [], "plan": [], "build": []}
    used = set()
    for kind, rx in KIND:
        # 도면 · 조감도는 파일 이름에 그 말이 있어야 (하위 분류 이름만으로는 사진이 섞입니다)
        cand = [f for f in files if (rx.search(f[0]) or (kind == "build" and rx.search(f[1])))
                and not re.search(r"plan your|planning|leadenhall|cheesegrater|beeldengroep|gruppe der|statue|sculpture", f[0], re.I)]
        # 파일 이름에 갈래 말이 직접 든 것 → 하위 분류 이름으로만 맞은 것, 그리고 그림(svg·png)을 사진보다 먼저(평면도)
        cand.sort(key=lambda f: (not rx.search(f[0]), not (kind == "plan" and re.search(r"\.(svg|png|gif)$", f[0], re.I)), f[0]))
        for fname, hint in cand:
            if len(got[kind]) >= per:
                break
            if fname in used:
                continue
            ci = info(fname)
            if not ci:
                continue
            used.add(fname)
            cap = re.sub(r"\.[a-z]{3,4}$", "", fname, flags=re.I).replace("_", " ")
            got[kind].append(dict(ci, cap=cap[:90]))
    toks = [w.lower() for w in re.findall(r"[A-Za-z]{4,}", cat) if w.lower() not in ("house", "building", "museum", "hall", "concert", "school", "primary", "chapel")]
    near = [f for f in files if any(t in f[0].lower() for t in toks)] or files
    for fname, hint in near:                  # 구조 · 외관 칸이 비면 분류의 다른 사진(건물 이름이 든 것 먼저)으로 채웁니다
        if len(got["build"]) >= per:
            break
        if fname in used or not re.search(r"\.(jpe?g|png)$", fname, re.I):
            continue
        ci = info(fname)
        if ci:
            used.add(fname)
            got["build"].append(dict(ci, cap=re.sub(r"\.[a-z]{3,4}$", "", fname, flags=re.I).replace("_", " ")[:90]))
    return got, len(files)
