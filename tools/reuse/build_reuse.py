# -*- coding: utf-8 -*-
"""
건축 리노베이션 · 도시재생 노트 만들기
  tools/reuse/reno*.py  (R = [...])  →  assets/data/renovations.json
  tools/reuse/regen*.py (U = [...])  →  assets/data/regenerations.json

  · 사진: 위키미디어 공용(Commons)의 자유 이용 사진만 (tools/architects/bimages.py)
  · 도면: ArchDaily 프로젝트 페이지 · WikiArquitectura · 공식 페이지의 그림을 원래 자리에서 불러와 보여 줌
          (tools/architects/adlinks.py — 그림 파일은 저장소에 복사하지 않음)
  · 받아 온 것은 tools/architects/cache.json 을 함께 씀

  python tools/reuse/build_reuse.py              둘 다
  python tools/reuse/build_reuse.py --리노베이션
  python tools/reuse/build_reuse.py --도시재생
"""
import io, os, re, sys, glob, json, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ARCH = os.path.join(HERE, "..", "architects")
sys.path.insert(0, ARCH)
import build as B          # get · wiki_more · wd_dates · commons_info · cache · wurl · adurl
import bimages, adlinks, drawing_labels

ROOT = B.ROOT


def load_parts(pattern, name):
    out = []
    for f in sorted([f for f in glob.glob(os.path.join(HERE, pattern)) if "_" not in os.path.basename(f)], key=lambda f: int(re.sub(r"\D", "", os.path.basename(f)) or 0)):
        ns = {}
        exec(compile(io.open(f, encoding="utf-8").read(), f, "exec"), ns)
        out += ns[name]
    out = [x for x in out if x]
    seen = set()
    for x in out:
        assert x["id"] not in seen, ("id 겹침", x["id"])
        seen.add(x["id"])
    return out


def fix_drawings(lst):
    outl, seen = [], set()
    for d in lst:
        d = dict(d)
        hit = next((v for k, v in drawing_labels.L.items() if k in d["u"]), "없음")
        if hit is None:
            continue
        if hit != "없음":
            d["kind"], d["label"] = hit
        d["img"] = d.get("img") or adlinks.image_of(B.cache, d["u"])
        key = d["img"].rsplit("/", 1)[-1] if "wikiarquitectura.com" in (d["img"] or "") else d["img"]
        if d["img"] and key not in seen:
            seen.add(key)
            outl.append(d)
    return outl


def enrich(x, firm_hint="", archdaily=True):
    """위키백과 · Commons 사진 · ArchDaily 도면 · References"""
    wm = B.wiki_more(x["wiki"]) if x.get("wiki") else {"qid": None, "pimg": None, "title": "", "ko": ""}
    wd = B.wd_dates(wm["qid"]) if wm["qid"] else {}
    cat = x["cat"] if "cat" in x else wd.get("cat", "")
    imgs, nfile = bimages.pick(B.get, B.commons_info, cat, per=x.get("_per", 3)) if cat else ({"concept": [], "plan": [], "build": []}, 0)
    main = (B.commons_info(wd.get("p18")) or B.commons_info(wm["pimg"])) if x.get("wiki") else None
    if main:
        imgs["build"] = [dict(main, cap="전경")] + [i for i in imgs["build"] if i["src"] != main["src"]][:max(2, x.get("_per", 3) - 1)]
    refs = []
    if wm["title"]:
        refs.append({"t": "Wikipedia", "u": B.wurl(wm["title"])})
        if wm["ko"]:
            refs.append({"t": "위키백과", "u": B.wurl(wm["ko"], "ko")})
    if cat:
        refs.append({"t": "Wikimedia Commons", "u": "https://commons.wikimedia.org/wiki/Category:" + urllib.parse.quote(cat.replace(" ", "_"))})
    ad = None
    if archdaily:
        name = x.get("adname") or re.sub(r"\s*\(.*?\)", "", x["t"]).strip()          # 괄호 뺀 건물 이름으로 맞추기
        ad = adlinks.collect(B.cache, "x:" + x["id"], name, firm_hint, x.get("adq"))
        if ad:
            ad = dict(ad, drawings=fix_drawings(ad.get("drawings", [])))
            refs.append({"t": "ArchDaily", "u": ad["u"]})
    more = adlinks.more_drawings(B.cache, "x:" + x["id"], x.get("waq") or re.sub(r"\s*\(.*?\)", "", x["t"]).strip(), x.get("more", [])) if archdaily else {"drawings": []}
    more = dict(more, drawings=list(more.get("drawings", [])))
    if more.get("wa"):
        refs.append({"t": "WikiArquitectura", "u": more["wa"]})
    for img, kind, label in x.get("draw", []):
        more["drawings"].append({"u": x.get("drawsrc") or img, "img": img, "kind": kind, "label": label,
                                 "site": urllib.parse.urlparse(x.get("drawsrc") or img).netloc.replace("www.", "")})
    if wd.get("site"):
        refs.append({"t": "공식 홈페이지", "u": wd["site"]})
    refs += x.get("refs", [])
    return dict(x, imgs=imgs, ad=ad, more=fix_drawings(more.get("drawings", [])), refs=refs), nfile


def renovations():
    R = load_parts("reno[0-9]*.py", "R")
    skip = [t for t in os.environ.get("RENO_SKIP", "").split(",") if t]      # 아직 조사 중인 묶음
    for mp in sorted(glob.glob(os.path.join(HERE, "reno_more*.py"))):    # 더 자세한 본문으로 덮어쓰기
        if any(os.path.basename(mp) == "reno_more_%s.py" % t for t in skip):
            print("   (건너뜀:", os.path.basename(mp), ")")
            continue
        ns = {}
        exec(compile(io.open(mp, encoding="utf-8").read(), mp, "exec"), ns)
        for x in R:
            more = ns["D"].get(x["id"])
            if more:
                refs = x.get("refs", []) + more.get("refs", [])
                x.update(more)
                x["refs"] = refs
    print("■ 리노베이션", len(R))
    out = []
    for x in R:
        firm = ""
        for k, v in x.get("spec", []):
            if "개조 설계" in k or k == "설계":
                m = re.search(r"\(([^)]+)\)", v)
                firm = m.group(1) if m else ""
                break
        if x.get("from_building"):                                  # Architecture 노트의 그림 · 도면을 그대로
            bj = json.load(io.open(os.path.join(ROOT, "assets", "data", "buildings.json"), encoding="utf-8"))
            b = next((i for i in bj["items"] if i["id"] == x["from_building"]), {})
            y = dict(x, imgs=b.get("imgs", {"concept": [], "plan": [], "build": []}), ad=b.get("ad"), more=b.get("more", []),
                     refs=b.get("refs", []) + x.get("refs", []))
        else:
            y, n = enrich(x, firm)
        out.append(y)
        print("  %-24s 사진 %d · 도면 %d" % (x["id"], sum(len(v) for v in y["imgs"].values()),
              len((y.get("ad") or {}).get("drawings", [])) + len(y["more"])))
    out.sort(key=lambda x: -int(re.sub(r"\D", "", str(x.get("y", "0")))[:4] or 0))
    write("renovations.json", out)


def regenerations():
    U = [x for x in load_parts("regen[0-9]*.py", "U")]
    for f in glob.glob(os.path.join(HERE, "regen*_actors.py")):       # 2) 개발주체 — 구분 · 주체 · 역할
        ns = {}
        exec(compile(io.open(f, encoding="utf-8").read(), f, "exec"), ns)
        for x in U:
            if x["id"] in ns["A"]:
                x["actors"] = ns["A"][x["id"]]
    skip = [t for t in os.environ.get("REGEN_SKIP", "").split(",") if t]     # 아직 조사 중인 묶음 (예: REGEN_SKIP=01,03)
    for mp in sorted(glob.glob(os.path.join(HERE, "regen_more*.py"))):  # 더 자세한 본문으로 덮어쓰기 (regen_more.py · regen_more_2.py …)
        if any(os.path.basename(mp) == "regen_more_%s.py" % t for t in skip):
            print("   (건너뜀:", os.path.basename(mp), ")")
            continue
        ns = {}
        exec(compile(io.open(mp, encoding="utf-8").read(), mp, "exec"), ns)
        for x in U:
            more = ns["D"].get(x["id"])
            if more:
                refs = x.get("refs", []) + more.get("refs", [])
                x.update(more)
                x["refs"] = refs
    kp = os.path.join(HERE, "regen_keep.py")                         # 옛 건물을 보존 · 활용한 사례만
    if os.path.exists(kp):
        ns = {}
        exec(compile(io.open(kp, encoding="utf-8").read(), kp, "exec"), ns)
        U = [x for x in U if x["id"] not in ns["EXCLUDE"]]
        for x in U:
            x["keep"] = ns["KEEP"].get(x["id"], x.get("keep", []))
            if not x["keep"]:
                print("   ! 보존 건물 목록 없음:", x["id"])
    PLAN = re.compile(r"계획가|건축가|전문가|설계|마스터플랜|조경")          # 2) 개발주체 — 도시계획가 · 건축가를 맨 앞에
    for x in U:
        rows = x.get("actors") or []
        x["actors"] = sorted(rows, key=lambda r: 0 if (isinstance(r, list) and len(r) > 2 and PLAN.search(r[0])) else 1)
        if rows and not any(isinstance(r, list) and len(r) > 2 and PLAN.search(r[0]) for r in rows):
            print("   ! 도시계획가 · 건축가 없음:", x["id"])
    print("■ 도시재생", len(U))
    out = []
    for x in U:
        x["_per"] = 6
        y, n = enrich(x, archdaily=False)
        y.pop("_per", None)
        out.append(y)
        print("  %-24s 사진 %d" % (x["id"], sum(len(v) for v in y["imgs"].values())))
    out.sort(key=lambda x: -int(re.findall(r"(?:19|20)\d\d", str(x.get("period", "0")))[0] if re.findall(r"(?:19|20)\d\d", str(x.get("period", ""))) else 0))
    write("regenerations.json", out)


def write(fname, items):
    io.open(B.CACHE, "w", encoding="utf-8").write(json.dumps(B.cache, ensure_ascii=False))
    p = os.path.join(ROOT, "assets", "data", fname)
    io.open(p, "w", encoding="utf-8").write(json.dumps({"made": time.strftime("%Y-%m-%d"), "items": items},
                                                     ensure_ascii=False, separators=(",", ":")))
    print("→", p, len(items))


if __name__ == "__main__":
    if "--도시재생" not in sys.argv:
        renovations()
    if "--리노베이션" not in sys.argv:
        regenerations()
