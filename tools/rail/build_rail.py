"""수도권(서울·경기·인천) 철도역 자료를 지도가 쓸 형태로 정리합니다.

    python tools/rail/build_rail.py

들어가는 것 (모두 OpenStreetMap 에서 받은 것)
    tools/rail/all.json        역 노드 + 노선 관계
    tools/rail/chunk*.json     노선의 정차역 노드 (이름을 얻으려고 따로 받음)

결과 : assets/data/seoul-rail.json
    [{"n":"서울역","a":37.55,"o":126.97,"L":[["1","#0052A4"],["4","#00A5DE"]]}]
      n 이름 · a 위도 · o 경도 · L [호선 번호, 색] 목록
"""
import glob
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DST = os.path.join(ROOT, "assets", "data", "seoul-rail.json")

# OSM 에 색이 없거나 엉뚱할 때 쓰는 공식 노선색
KNOWN = {
    "1": "#0052A4", "2": "#00A84D", "3": "#EF7C1C", "4": "#00A5DE",
    "5": "#996CAC", "6": "#CD7C2F", "7": "#747F00", "8": "#E6186C",
    "9": "#BDB092",
    "신분당": "#D4003B", "경의중앙": "#77C4A3", "공항철도": "#0090D2",
    "수인분당": "#FABE00", "경춘": "#0C8E72", "우이신설": "#B7C452",
    "신림": "#6789CA", "김포골드": "#A17E46", "서해": "#8FC31F",
    "인천1": "#7CA8D5", "인천2": "#F5A200", "의정부": "#FDA600",
    "용인에버라인": "#509F22", "경강": "#003DA5", "GTX-A": "#9A6292",
}


# 오래 달리는 일반열차(KTX·무궁화 등)는 '호선' 이 아니므로 뺍니다
INTERCITY = re.compile(
    r"KTX|ITX|SRT|무궁화|새마을|누리로|итx|관광|정선아리랑|A-?train|S-?train",
    re.I)


def short(tags):
    """노선 이름을 짧게 — 숫자 호선은 숫자만, 나머지는 알아볼 만큼만.
       서울 2호선과 인천 2호선이 뭉치지 않도록 지역을 앞에 붙입니다."""
    name = (tags.get("name:ko") or tags.get("name") or "").split(":")[0]
    net = (tags.get("network:ko") or tags.get("network") or "")
    ref = (tags.get("ref") or "")
    flat = (name + " " + net + " " + ref).replace(" ", "").replace("·", "")

    if INTERCITY.search(name) or INTERCITY.search(tags.get("ref") or ""):
        return None                                   # 일반열차는 건너뜁니다

    region = ""
    if "인천" in flat and "도시철도" in flat:
        region = "인천"
    elif "의정부" in flat:
        return "의정부"
    elif "용인" in flat and ("에버라인" in flat or "경전철" in flat):
        return "용인에버라인"
    elif "김포" in flat:
        return "김포골드"

    r = (tags.get("ref") or "").strip()
    m = re.search(r"(\d+)호선", name)
    num = m.group(1) if m else (r if re.fullmatch(r"\d+", r) else "")
    if num:
        return region + num

    for key in ("신분당", "경의중앙", "공항철도", "수인분당", "경춘",
                "우이신설", "신림", "서해", "경강", "GTX-A"):
        if key.replace("-", "") in flat.replace("-", ""):
            return key
    return None                                        # 알아보지 못하면 넣지 않습니다


def colour(tags, label):
    """공식 노선색을 먼저 씁니다. 같은 번호가 서로 다른 색으로 갈라지지 않게."""
    if label in KNOWN:
        return KNOWN[label]
    c = (tags.get("colour") or tags.get("color") or "").strip()
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", c):
        return c.upper()
    return "#2F9E44"


def main():
    data = json.load(io.open(os.path.join(HERE, "all.json"), encoding="utf-8"))
    rels = [e for e in data["elements"] if e["type"] == "relation"]
    stations = [e for e in data["elements"] if e["type"] == "node"]

    # 정차역 노드 id -> 이름
    stop_name = {}
    for f in sorted(glob.glob(os.path.join(HERE, "chunk*.json"))):
        try:
            d = json.load(io.open(f, encoding="utf-8"))
        except ValueError:
            continue
        for e in d.get("elements", []):
            t = e.get("tags") or {}
            nm = (t.get("name:ko") or t.get("name") or "").strip()
            if nm:
                stop_name[e["id"]] = nm

    # 역 이름 -> {(호선, 색)}
    by_name = {}
    for r in rels:
        t = r.get("tags") or {}
        label = short(t)
        if not label:
            continue
        col = colour(t, label)
        for m in r.get("members", []):
            if m["type"] != "node" or "stop" not in (m.get("role") or ""):
                continue
            nm = stop_name.get(m["ref"])
            if nm:
                by_name.setdefault(nm, set()).add((label, col))

    def sort_key(item):
        lab = item[0]
        return (0, int(lab)) if lab.isdigit() else (1, lab)

    out, seen = [], set()
    for e in stations:
        t = e.get("tags") or {}
        name = (t.get("name:ko") or t.get("name") or "").strip()
        lat, lon = e.get("lat"), e.get("lon")
        if not name or lat is None or lon is None:
            continue
        key = (name, round(lat, 3), round(lon, 3))
        if key in seen:
            continue
        seen.add(key)
        lines = sorted(by_name.get(name, set()), key=sort_key)
        out.append({
            "n": name,
            "a": round(lat, 5),
            "o": round(lon, 5),
            "L": [[l, c] for l, c in lines],
        })

    out.sort(key=lambda x: x["n"])
    io.open(DST, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")))

    withline = sum(1 for x in out if x["L"])
    print("saved %d stations (%d with line info) -> %s" % (len(out), withline, DST))


if __name__ == "__main__":
    main()
