# -*- coding: utf-8 -*-
"""
건축가 노트 만들기 — tools/architects/part*.py 의 글을 모아 assets/data/architects.json 으로.

  · 생몰일(P569 · P570)과 설립일(P571)은 위키데이터에서 받아 옵니다 (기억으로 적지 않습니다).
  · 사진은 위키미디어 공용(Commons)의 **자유 이용 사진만** 씁니다 — 위키백과 문서의 대표 그림 중
    Commons 에 있는 것만 고르고, 저작자·라이선스를 함께 적어 둡니다. (공정 이용 그림은 쓰지 않음)
  · 받아 온 것은 cache.json 에 두어 다시 묻지 않습니다.

  python tools/architects/build.py            모으기
  python tools/architects/build.py --다시     캐시를 버리고 다시 받기
"""
import io, os, re, sys, json, glob, time, urllib.request, urllib.parse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "assets", "data", "architects.json")
BOUT = os.path.join(ROOT, "assets", "data", "buildings.json")
CACHE = os.path.join(HERE, "cache.json")
UA = "skyish.kr-architect-notes/1.0 (https://skyish.kr; personal study site)"

cache = {} if "--다시" in sys.argv else (json.load(io.open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {})


def get(url):
    if url in cache:
        return cache[url]
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                j = json.loads(r.read().decode("utf-8"))
            cache[url] = j
            time.sleep(0.15)
            return j
        except Exception as e:
            time.sleep(1.5 * (i + 1))
    return {}


def wiki_page(title):
    """영문 위키백과 문서 → (wikidata id, 대표 그림 파일 이름, 600px 썸네일)"""
    w = wiki_more(title)
    return (w["qid"], w["pimg"], w["thumb"])


def wiki_more(title):
    """영문 위키백과 문서 → qid · 그림 · 실제 제목(넘겨주기 뒤) · 한국어 위키백과 제목"""
    q = urllib.parse.urlencode({"action": "query", "format": "json", "redirects": 1, "titles": title,
                                "prop": "pageprops|pageimages|langlinks", "piprop": "name|thumbnail",
                                "pithumbsize": 640, "lllang": "ko"})
    j = get("https://en.wikipedia.org/w/api.php?" + q)
    for p in (j.get("query", {}).get("pages", {}) or {}).values():
        if "missing" in p:
            break
        return {"qid": p.get("pageprops", {}).get("wikibase_item"), "pimg": p.get("pageimage"),
                "thumb": (p.get("thumbnail") or {}).get("source"), "title": p.get("title", title),
                "ko": ((p.get("langlinks") or [{}])[0]).get("*", "")}
    return {"qid": None, "pimg": None, "thumb": None, "title": "", "ko": ""}


def wurl(title, lang="en"):
    return "https://%s.wikipedia.org/wiki/%s" % (lang, urllib.parse.quote(title.replace(" ", "_")))


def adurl(q):
    return "https://www.archdaily.com/search/all?q=" + urllib.parse.quote(q)


def commons_info(fname):
    """Commons 에 있는 자유 이용 그림이면 {src, page, license, artist}, 아니면 None"""
    if not fname:
        return None
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + fname,
                                "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 640})
    j = get("https://commons.wikimedia.org/w/api.php?" + q)
    for p in (j.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [None])[0]
        if not ii:
            return None                      # Commons 에 없음 (공정 이용 그림) — 쓰지 않습니다
        md = ii.get("extmetadata", {})
        lic = (md.get("LicenseShortName") or {}).get("value", "")
        if re.search(r"fair use|non-free", lic, re.I):
            return None
        artist = re.sub(r"<[^>]+>", "", (md.get("Artist") or {}).get("value", "")).strip()
        return {"src": ii.get("thumburl") or ii.get("url"), "page": ii.get("descriptionurl"),
                "license": lic, "artist": artist[:80]}
    return None


def wd_dates(qid):
    """위키데이터 — 출생 · 사망 · 설립일과 대표 사진(P18)"""
    if not qid:
        return {}
    j = get("https://www.wikidata.org/wiki/Special:EntityData/%s.json" % qid)
    ent = (j.get("entities") or {}).get(qid, {})
    cl = ent.get("claims", {})
    def t(pid):
        cs = cl.get(pid, [])
        if len({((c.get("mainsnak") or {}).get("datavalue") or {}).get("value", {}).get("time", "")[:11] for c in cs}) > 1:
            print("   ! 위키데이터 %s 값이 여럿 — %s %s (틀리면 노트에 직접 적어 두세요)" % (pid, qid, [((c.get("mainsnak") or {}).get("datavalue") or {}).get("value", {}).get("time", "")[:11] for c in cs]))
        cs = sorted(cs, key=lambda c: (c.get("rank") != "preferred",          # 우선 순위 → 더 자세한 날짜
                                       -(((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}).get("precision", 0)))
        for c in cs:
            v = (((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {})
            if isinstance(v, dict) and v.get("time"):
                m = re.match(r"[+-](\d{4})-(\d\d)-(\d\d)", v["time"])
                if m:
                    y, mo, d = m.groups()
                    prec = v.get("precision", 11)
                    return y if prec <= 9 else (y + "." + mo if prec == 10 else y + "." + mo + "." + d)
        return ""
    def v(pid):
        for c in cl.get(pid, []):
            x = (((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")) or ""
            if x and isinstance(x, str): return x
        return ""
    return {"born": t("P569"), "died": t("P570"), "founded": t("P571"), "p18": v("P18"), "site": v("P856"), "cat": v("P373")}


# 상 목록에서 이 건축가를 알아보는 다른 이름 (팀 · 사무소는 사람 이름으로도 받습니다)
ALIAS = {
 "sanaa": ["Kazuyo Sejima", "Ryue Nishizawa"], "grafton": ["Yvonne Farrell", "Shelley McNamara", "Grafton Architects"],
 "lacatonvassal": ["Anne Lacaton", "Jean-Philippe Vassal", "Lacaton"], "rcr": ["Rafael Aranda", "Carme Pigem", "Ramon Vilalta"],
 "hdm": ["Herzog & de Meuron", "Jacques Herzog", "Pierre de Meuron"], "dsr": ["Elizabeth Diller", "Diller Scofidio"],
 "unstudio": ["Ben van Berkel"], "mecanoo": ["Francine Houben"], "massstudies": ["Minsuk Cho"],
 "vtn": ["Vo Trong Nghia"], "oma": ["Rem Koolhaas", "Office for Metropolitan Architecture"], "big": ["Bjarke Ingels"],
 "mad": ["Ma Yansong"], "gang": ["Jeanne Gang"], "zaha": ["Zaha Hadid"],
 "foster": ["Norman Foster", "Foster + Partners", "Foster and Partners", "Foster Associates"],
 "adjaye": ["David Adjaye"], "rogers": ["Richard Rogers", "Rogers Stirk Harbour"], "stirling": ["James Stirling"],
 "chipperfield": ["David Chipperfield"], "snohetta": ["Snøhetta", "Snohetta"], "kere": ["Francis Kéré"],
 "aravena": ["Alejandro Aravena", "ELEMENTAL"], "venturi": ["Robert Venturi"], "liujiakun": ["Liu Jiakun"],
}


def main():
    sys.path.insert(0, HERE)
    import awards as AW
    A = []
    for f in sorted(glob.glob(os.path.join(HERE, "part*.py")), key=lambda f: int(re.sub(r"\D", "", os.path.basename(f)) or 0)):
        ns = {}
        exec(compile(io.open(f, encoding="utf-8").read(), f, "exec"), ns)
        A += ns["A"]
    seen = set()
    for a in A:
        assert a["id"] not in seen, ("id 겹침", a["id"]); seen.add(a["id"])
    print("■ 상 목록")
    AWD = AW.collect(get)
    print("■ 건축가")
    out = []
    for a in A:
        wm = wiki_more(a.get("wiki") or a["name"])
        wd = wd_dates(wm["qid"])
        # 사진 — 위키데이터 대표 사진(P18)을 먼저, 없으면 위키백과 문서 그림 (Commons 것만)
        img = commons_info(wd.get("p18")) or commons_info(wm["pimg"])
        works = []
        for w in a.get("works", []):
            ww = wiki_more(w.get("wiki") or w["t"])
            wd2 = wd_dates(ww["qid"]) if ww["qid"] else {}
            own = bool(ww["title"]) and ww["title"] != wm["title"]   # 작품 자체의 문서가 있나 (건축가 문서로 대신한 것은 빼고)
            wi = (commons_info(wd2.get("p18")) or commons_info(ww["pimg"])) if own else None
            refs = []
            if own:
                refs.append({"t": "Wikipedia", "u": wurl(ww["title"])})
                if ww["ko"]: refs.append({"t": "위키백과", "u": wurl(ww["ko"], "ko")})
            refs.append({"t": "ArchDaily", "u": adurl(w["t"])})
            works.append(dict(w, img=wi, refs=refs))
        refs = []
        if wm["title"]: refs.append({"t": "Wikipedia", "u": wurl(wm["title"])})
        if wm["ko"]: refs.append({"t": "위키백과", "u": wurl(wm["ko"], "ko")})
        if wd.get("site"): refs.append({"t": "공식 홈페이지", "u": wd["site"]})
        refs.append({"t": "ArchDaily", "u": adurl(a.get("firm") if a.get("kind") == "사무소" else (wm["title"] or a["name"]))})
        if a.get("pritzker"): refs.append({"t": "Pritzker Prize", "u": "https://www.pritzkerprize.com/laureates"})
        if wm["qid"]: refs.append({"t": "Wikidata", "u": "https://www.wikidata.org/wiki/" + wm["qid"]})
        refs += a.get("refs", [])
        keys = [k for k in [re.sub(r"\s*\(.*?\)", "", wm["title"] or ""), a.get("wiki", "")] + ALIAS.get(a["id"], []) if k]
        b = dict(a, works=works, img=img, born=a.get("born") or wd.get("born", ""), died=a.get("died") or wd.get("died", ""),
                 founded=wd.get("founded", ""), refs=refs, qid=wm["qid"] or "",
                 _keys=[AW.fold(k) for k in keys], _titles=[AW.fold(wm["title"] or "")])
        out.append(b)
        print("%-14s %s~%s  사진:%s  작품사진:%d/%d" % (a["id"], b["born"], b["died"], "O" if img else "-",
                                                    sum(1 for w in works if w["img"]), len(works)))

    # 상 목록과 건축가 잇기 — 수상자 칸의 링크(문서 제목) 또는 이름이 맞으면
    def who_ids(r):
        ls = [AW.fold(l) for l in r.get("links", [])]
        w = " " + AW.fold(r.get("who", "")) + " "
        return [b["id"] for b in out
                if any(t and t in ls for t in b["_titles"]) or any(k and (" " + k + " ") in w for k in b["_keys"])]
    for aid, aw in AWD.items():
        for r in aw["rows"]:
            r["ids"] = who_ids(r)
            for i in r["ids"]:
                b = next(x for x in out if x["id"] == i)
                L = b.setdefault("awards", [])
                if not any(x["id"] == aid and x["y"] == r["y"] and x["work"] == r.get("work", "") for x in L):   # 팀과 사람이 따로 올라 있어도 한 번만
                    L.append({"id": aid, "ko": aw["ko"], "y": r["y"], "work": r.get("work", "")})
    for b in out:
        b["awards"] = sorted(b.get("awards", []), key=lambda x: x["y"])
        b.pop("_keys"); b.pop("_titles")
        if b.get("pritzker") and not any(x["id"] == "pritzker" and x["y"] == b["pritzker"] for x in b["awards"]):
            print("   ! 프리츠커 연결 안 됨:", b["id"])
    io.open(CACHE, "w", encoding="utf-8").write(json.dumps(cache, ensure_ascii=False))
    doc = {"made": time.strftime("%Y-%m-%d"), "items": out,
           "awards": {"architect": [AWD[a["id"]] for a in AW.ARCHITECT_AWARDS],
                      "building": [AWD[a["id"]] for a in AW.BUILDING_AWARDS]}}
    io.open(OUT, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print("→", OUT, len(out), "명")
    buildings()


def buildings():
    """건축물 노트 — tools/architects/buildings.py + 위키미디어 공용 그림 → assets/data/buildings.json"""
    import bimages
    ns = {}
    f = os.path.join(HERE, "buildings.py")
    exec(compile(io.open(f, encoding="utf-8").read(), f, "exec"), ns)
    f2 = os.path.join(HERE, "buildings_more.py")             # 더 자세한 본문으로 덮어쓰기
    if os.path.exists(f2):
        ns2 = {}
        exec(compile(io.open(f2, encoding="utf-8").read(), f2, "exec"), ns2)
        for b in ns["B"]:
            b.update(ns2["D"].get(b["id"], {}))
    for b in ns["B"]:                                          # 수상 연도(가장 최근) — 최근 수상을 위로
        ys = [int(y) for y in re.findall(r"(?:19|20)\d\d", b.get("award", ""))]
        b["ay"] = max(ys) if ys else b.get("y", 0)
    ns["B"].sort(key=lambda b: -b["ay"])
    print("■ 건축물")
    out = []
    for b in ns["B"]:
        wm = wiki_more(b["wiki"])
        wd = wd_dates(wm["qid"])
        cat = b["cat"] if "cat" in b else wd.get("cat", "")
        imgs, nfile = bimages.pick(get, commons_info, cat) if cat else ({"concept": [], "plan": [], "build": []}, 0)
        main = (commons_info(wd.get("p18")) or commons_info(wm["pimg"])) if b["wiki"] not in ("Lacaton & Vassal", "Kingston University") else None
        if main:                                  # 대표 사진은 「재료 및 구조」 앞에
            imgs["build"] = [dict(main, cap="전경")] + [x for x in imgs["build"] if x["src"] != main["src"]][:2]
        own = b["wiki"] not in ("Lacaton & Vassal", "Kingston University")   # 건축물 자체의 위키백과 문서가 있나
        refs = []
        if own and wm["title"]:
            refs.append({"t": "Wikipedia", "u": wurl(wm["title"])})
            if wm["ko"]: refs.append({"t": "위키백과", "u": wurl(wm["ko"], "ko")})
        if cat: refs.append({"t": "Wikimedia Commons", "u": "https://commons.wikimedia.org/wiki/Category:" + urllib.parse.quote(cat.replace(" ", "_"))})
        refs.append({"t": "ArchDaily", "u": adurl(b["t"])})
        if wd.get("site") and own: refs.append({"t": "공식 홈페이지", "u": wd["site"]})
        refs += b.get("refs", [])
        out.append(dict(b, imgs=imgs, refs=refs))
        print("%-20s 분류:%-28s 파일 %3d → 컨셉 %d · 도면 %d · 구조 %d" % (b["id"], (cat or "-")[:28], nfile,
              len(imgs["concept"]), len(imgs["plan"]), len(imgs["build"])))
    io.open(CACHE, "w", encoding="utf-8").write(json.dumps(cache, ensure_ascii=False))
    io.open(BOUT, "w", encoding="utf-8").write(json.dumps({"made": time.strftime("%Y-%m-%d"), "items": out},
                                                        ensure_ascii=False, separators=(",", ":")))
    print("→", BOUT, len(out), "곳")


def fold_t(s):
    return re.sub(r"\W+", " ", (s or "").lower()).strip()


if __name__ == "__main__":
    if "--건축물" in sys.argv:
        sys.path.insert(0, HERE)
        buildings()
    else:
        main()
