"""OpenStreetMap 에서 받은 역 목록(raw.json)을 지도가 쓸 형태로 정리합니다.

    python tools/rail/build_rail.py

결과 : assets/data/seoul-rail.json
"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "raw.json")
DST = os.path.join(ROOT, "assets", "data", "seoul-rail.json")


def main():
    with io.open(SRC, encoding="utf-8") as f:
        data = json.load(f)

    out, seen = [], set()
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = (tags.get("name:ko") or tags.get("name") or "").strip()
        lat, lon = el.get("lat"), el.get("lon")
        if not name or lat is None or lon is None:
            continue

        # 환승역이 여러 점으로 잡히는 경우가 있어, 같은 이름·거의 같은 자리는 한 번만
        key = (name, round(lat, 3), round(lon, 3))
        if key in seen:
            continue
        seen.add(key)

        line = (tags.get("operator:ko") or tags.get("operator")
                or tags.get("network:ko") or tags.get("network") or "")
        out.append({
            "n": name,
            "a": round(lat, 5),
            "o": round(lon, 5),
            "l": line[:40],
        })

    out.sort(key=lambda x: x["n"])
    with io.open(DST, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print("saved %d stations -> %s" % (len(out), DST))


if __name__ == "__main__":
    main()
