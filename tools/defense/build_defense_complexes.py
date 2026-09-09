#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
경기도 산업단지 목록 → assets/data/defense/complexes.json

defense-cluster.html 의 ① 지도에 「산업단지」 체크상자로 겹쳐 보이는 자료입니다.
방산기업이 어느 산업단지 안팎에 자리하는지 눈으로 견주어 보려는 것입니다.

원본 : auth/산업단지/산업입지_display_new.shp  (산업입지정보시스템, 2021.3, 점 자료 157건)
       좌표계 ITRF2000 TM(중부원점) — 속성에 위도·경도(WGS84) 가 따로 있어 그 값을 씁니다.
       DBF 칸 이름이 열 바이트에서 잘려 「조성상」「지정면」 처럼 보입니다.
         유형   국가 / 일반 / 도시첨단 / 농공
         조성상  조성상태 — 완료 / 조성중
         지정면  지정면적 (천㎡)
         관리면  관리면적 (천㎡)
         전체면  뜻이 확실하지 않아(분양 대상 면적으로 보임) 화면에는 내지 않습니다.

출력 : assets/data/defense/complexes.json  (약 25 KB)
       깃헙에는 올라가지 않습니다(.gitignore). admin/data.html 에 끌어다 놓으면
       Supabase 비공개 보관함 analysis/defense/ 에 들어갑니다.

실행 : python tools/defense/build_defense_complexes.py
"""
import json
import sys
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "auth" / "산업단지" / "산업입지_display_new.shp"
OUT = ROOT / "assets" / "data" / "defense" / "complexes.json"

# 원본에서 지오코딩이 빗나간 것 — 이름으로 찍어 바로잡습니다.
#   아산국가산업단지(모단지) 가 미국 애틀랜타(33.79, -84.39) 로 잡혀 있습니다.
#   경기도 쪽은 평택시 포승읍 일대라, 아래 원정지구·포승지구 두 점 사이에 둡니다.
FIX = {
    "아산국가산업단지": {"lat": 36.996, "lon": 126.829,
                    "note": "원본 좌표가 빗나가 포승읍(원정·포승지구 사이)으로 옮겨 찍었습니다"},
}

# 유형별 색 — ① 의 기업 분야 색(파랑·청록·보라·회색·분홍·주황·초록)과 겹치지 않는 쪽으로
TYPE_COLOR = {
    "국가": "#1e293b",
    "일반": "#64748b",
    "도시첨단": "#0f766e",
    "농공": "#a16207",
}
TYPE_ORDER = ["국가", "일반", "도시첨단", "농공"]


def clean_si(v):
    """「용인시 처인구」 처럼 구까지 적힌 것은 시까지만"""
    s = str(v or "").strip()
    return s.split()[0] if s else ""


def main():
    if not SRC.exists():
        sys.exit("원본이 없습니다: %s" % SRC)
    g = gpd.read_file(SRC, encoding="cp949")

    items, fixed = [], 0
    for _, r in g.iterrows():
        name = str(r["단지명"]).strip()
        lat, lon = float(r["위도"]), float(r["경도"])
        note = str(r["비고"]).strip() if r["비고"] else ""
        if name in FIX:
            lat, lon = FIX[name]["lat"], FIX[name]["lon"]
            note = (note + " · " if note else "") + FIX[name]["note"]
            fixed += 1
        # 남한 밖이면 자료 잘못 — 지도에 못 올립니다
        if not (33 <= lat <= 39 and 124 <= lon <= 132):
            print("!! 좌표가 남한 밖이라 뺍니다:", name, lat, lon)
            continue
        item = {
            "name": name,
            "type": str(r["유형"]).strip(),
            "status": str(r["조성상"]).strip(),
            "si": clean_si(r["시군"]),
            "addr": str(r["주소"]).strip() if r["주소"] else "",
            "area": int(r["지정면"]),          # 지정면적 (천㎡)
            "managed": int(r["관리면"]),       # 관리면적 (천㎡)
            "lat": round(lat, 6),
            "lon": round(lon, 6),
        }
        if note:
            item["note"] = note
        items.append(item)

    # 큰 것을 먼저 그려 작은 것이 위에 오게 — 면적 내림차순
    items.sort(key=lambda d: -d["area"])

    types = []
    for t in TYPE_ORDER:
        sel = [d for d in items if d["type"] == t]
        if sel:
            types.append({"key": t, "n": len(sel), "color": TYPE_COLOR[t],
                          "area": sum(d["area"] for d in sel)})
    status = {}
    for d in items:
        status[d["status"]] = status.get(d["status"], 0) + 1
    by_si = {}
    for d in items:
        by_si[d["si"]] = by_si.get(d["si"], 0) + 1

    doc = {
        "src": "산업입지정보시스템 · 경기도 산업단지 (2021.3, 점 자료)",
        "unit": "천㎡",
        "n": len(items),
        "area": sum(d["area"] for d in items),
        "fixed": fixed,
        "types": types,
        "status": status,
        "bySi": sorted(({"si": k, "n": v} for k, v in by_si.items()),
                       key=lambda x: -x["n"]),
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print("→", OUT.relative_to(ROOT), "%d KB" % (OUT.stat().st_size // 1024))
    print("   단지 %d곳 · 유형 %s · 상태 %s · 좌표 바로잡음 %d" %
          (len(items), {t["key"]: t["n"] for t in types}, status, fixed))


if __name__ == "__main__":
    main()
