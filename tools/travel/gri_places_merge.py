# -*- coding: utf-8 -*-
"""
출장지 합치기 — _places/places.json ([{num, places:[…]}], Claude 요원들이 보고서 전문을 읽고 뽑은 것) → gri.json

  「보고서 문장에서 최대한 상세하게 갔던 곳들, 건물 이름, 장소 이름을 가능한 한 출장지에 다 넣어줘」

  요원이 지어낸 이름이 섞이지 않게, 보고서 글자(또는 게시글 본문)에 **정말 있는 이름만** 남깁니다:
  띄어쓰기·괄호를 뺀 뒤 한글 부분이나 원어 부분이 글자에 그대로 있어야 합니다.
  gri_places.py(규칙으로 뽑은 옛 목록)에만 있던 것은 뒤에 덧붙입니다.

돌리는 법 :  python tools/travel/gri_places_merge.py [places.json 경로]
"""
import io, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(HOME, "11.해외출장보고_Data")
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "_places", "places.json")
MAX = 60

squash = lambda s: re.sub(r"[\s·・,.'’‘\-–—()（）\[\]「」『』/]", "", str(s or "")).lower()
GENERIC = {"호텔", "공항", "역", "시청", "대학", "박물관", "공원", "센터", "연구소", "시", "구", "현", "도시", "지역"}

def text_of(p):
    t = [p.get("body") or ""]
    for f in p.get("files") or []:
        tp = os.path.join(D, "_text", re.sub(r"\.\w+$", "", f["file"]) + ".txt")
        if os.path.exists(tp):
            t.append(io.open(tp, encoding="utf-8").read())
    return squash("\n".join(t))

def present(name, hay):
    """「한글(원어)」 이면 어느 한쪽이라도 글자에 있으면 됩니다"""
    parts = [name] + re.findall(r"\(([^()]{2,})\)", name) + [re.sub(r"\([^()]*\)", "", name)]
    for part in parts:
        k = squash(part)
        if len(k) >= 2 and k in hay:
            return True
    return False

items = json.load(io.open(SRC, encoding="utf-8"))
if isinstance(items, dict):
    items = items.get("items") or []
by = {int(it["num"]): it.get("places") or [] for it in items if it and "num" in it}

gp = os.path.join(D, "gri.json")
doc = json.load(io.open(gp, encoding="utf-8"))
tot = kept = dropped = 0
for p in doc["posts"]:
    hay = text_of(p)
    old = p.get("places") or []
    new = []
    seen = set()
    for x in by.get(int(p["num"]), []) + old:
        x = re.sub(r"\s+", " ", str(x or "")).strip(" .,;:")
        if not x or len(x) > 60 or x in GENERIC:
            continue
        k = squash(x)
        if not k or k in seen:
            continue
        if any(k in squash(c) or squash(c) == k for c in (p.get("countries") or [])):
            continue                                   # 나라 이름만인 것은 지역 칸에 이미 있습니다
        tot += 1
        if not present(x, hay):
            dropped += 1; continue
        seen.add(k); new.append(x); kept += 1
    p["places"] = new[:MAX]
io.open(gp, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1))
have = sum(1 for p in doc["posts"] if p["places"])
lens = sorted(len(p["places"]) for p in doc["posts"])
print(f"출장지 있는 글 {have}/{len(doc['posts'])} · 이름 {kept}개 남김 · 원문에 없어 뺀 것 {dropped}개 · 글당 중간 {lens[len(lens)//2]} 최대 {lens[-1]}")
for p in doc["posts"][:3]:
    print(" ", p["num"], p["places"][:12])
