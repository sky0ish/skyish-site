# -*- coding: utf-8 -*-
"""
[노후산단] 화면(aging-complex.html)이 읽는 자료 만들기

  원본 : G:/내 드라이브/000.GIS_2024/1_산업단지  (QGIS 프로젝트 GG_노후산단분석.qgz 가 쓰는 것과 같은 자료)
    gpkg/산업단지목록_경계매칭_노후도추가.gpkg   산업단지경계_매칭(경계+목록, 노후년도) · DAM_DAN_미매칭경계
    gpkg/gg_station_307_road_new_new.gpkg         경기 철도역 307
    gpkg/pop_total.gpkg                            인구 100m 격자 (경기, 1,029,094칸)
  행정경계 : G:/내 드라이브/000.GIS_2024/00.행정구역2026  (시도 · 시군구 · 읍면동, 2026)

  만드는 것 (assets/data/aging/ — 공개 자료라 저장소에 함께 둡니다)
    complexes.json   산업단지 경계 (경기·서울·인천, WGS84, 10m 단순화) + 노후년도·목록 정보 + 가장 가까운 역
    stations.json    역 307 (이름·노선·GTX)
    sido.json        시도 윤곽 (경기·서울·인천)
    sig.json         시군구 경계 + 이름 (경기·서울·인천)
    emd.json         읍면동 경계 (경기)
    pop_density.png  인구밀도 6단계 초록 격자 그림 (WGS84 축에 맞춰 다시 표본화)
    pop_meta.json    그림 범위·급간, 500m 격자 값(클릭해 보기)

돌리는 법 :  python tools/aging/build_aging.py
"""
import io, json, os, sys, math, base64, time
import numpy as np
import geopandas as gpd, pyogrio
from shapely.geometry import box
from pyproj import Transformer
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = r"G:\내 드라이브\000.GIS_2024\1_산업단지"
ADM = r"G:\내 드라이브\000.GIS_2024\00.행정구역2026"
OUT = os.path.join(HOME, "assets", "data", "aging")
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
say = lambda *a: print("%5.0fs" % (time.time() - t0), *a)

def dump(gdf, name, props, simplify_m=None, prec=5):
    """GeoDataFrame(EPSG:5179 등 미터 좌표) → 소수 prec 자리 WGS84 GeoJSON"""
    g = gdf.copy()
    if simplify_m:
        g["geometry"] = g.geometry.simplify(simplify_m, preserve_topology=True)
    g = g.to_crs("EPSG:4326")
    feats = []
    for _, r in g.iterrows():
        geom = json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"]
        geom = round_coords(geom, prec)
        feats.append({"type": "Feature", "properties": {k: (None if (isinstance(r[k], float) and math.isnan(r[k])) else r[k]) for k in props if k in r}, "geometry": geom})
    doc = {"type": "FeatureCollection", "features": feats}
    p = os.path.join(OUT, name)
    io.open(p, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
    say(name, len(feats), "features", "%.0f KB" % (os.path.getsize(p) / 1024))
    return doc

def round_coords(geom, prec):
    def rc(c):
        if isinstance(c[0], (int, float)): return [round(c[0], prec), round(c[1], prec)]
        return [rc(x) for x in c]
    geom["coordinates"] = rc(geom["coordinates"]); return geom

# ── 행정경계 ─────────────────────────────────────────────
sido = gpd.read_file(os.path.join(ADM, "시도", "ctp_rvn_utf8.shp"))
sido = sido[sido["CTP_KOR_NM"].isin(["경기도", "서울특별시", "인천광역시"])]
gg = sido[sido["CTP_KOR_NM"] == "경기도"].geometry.iloc[0]
area3 = sido.geometry.union_all()
dump(sido.rename(columns={"CTP_KOR_NM": "name"}), "sido.json", ["name"], simplify_m=120, prec=4)
sig = gpd.read_file(os.path.join(ADM, "시군구", "sig_utf8.shp"))
sig = sig[sig["SIG_CD"].str[:2].isin(["41", "11", "28"])].rename(columns={"SIG_KOR_NM": "name", "SIG_CD": "code"})
dump(sig, "sig.json", ["code", "name"], simplify_m=45, prec=4)
emd = gpd.read_file(os.path.join(ADM, "읍면동", "emd_utf8.shp"))
emd = emd[emd["EMD_CD"].str[:2] == "41"].rename(columns={"EMD_KOR_NM": "name", "EMD_CD": "code"})
dump(emd, "emd.json", ["name"], simplify_m=20, prec=4)

# ── 역 ───────────────────────────────────────────────────
st = gpd.read_file(os.path.join(SRC, "gpkg", "gg_station_307_road_new_new.gpkg"))
st = st.to_crs("EPSG:5179")
def lines(r):
    L = [str(r.get(k) or "").strip() for k in ["노선명_new", "노선명2_new", "노선명3_new"]]
    L = [x for x in L if x and x.lower() not in ("nan", "none")]
    return " · ".join(dict.fromkeys(L))
st["lines"] = st.apply(lines, axis=1)
st["gtx"] = st["GTX_new"].fillna(st["GTX"] if "GTX" in st else "").fillna("").astype(str).str.strip().replace({"nan": "", "None": "", "NaN": ""})
st["name"] = st["st_nm"].astype(str).str.strip()
st4326 = st.to_crs("EPSG:4326")
stations = [{"name": r["name"], "lines": r["lines"], "gtx": r["gtx"], "si": str(r.get("si") or ""), "sgg": str(r.get("sgg") or ""),
             "lon": round(r.geometry.x, 6), "lat": round(r.geometry.y, 6), "x": round(g.x), "y": round(g.y)}
            for (_, r), g in zip(st4326.iterrows(), st.geometry)]
for s_ in stations:
    for k_, v_ in list(s_.items()):
        if isinstance(v_, float) and math.isnan(v_): s_[k_] = ""
io.open(os.path.join(OUT, "stations.json"), "w", encoding="utf-8").write(json.dumps({"n": len(stations), "crs_xy": "EPSG:5179", "items": stations}, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
say("stations.json", len(stations))

# ── 산업단지 경계 ─────────────────────────────────────────
f = os.path.join(SRC, "gpkg", "산업단지목록_경계매칭_노후도추가.gpkg")
cx = gpd.read_file(f, layer="산업단지경계_매칭").to_crs("EPSG:5179")
cx = cx[cx.geometry.intersects(area3)]
say("경계매칭 (경기·서울·인천 안)", len(cx), "rows,", cx["DAN_ID"].nunique(), "unique DAN_ID")
# 같은 경계(DAN_ID)에 목록 줄이 여럿 붙은 것은 하나로 — 노후년도는 가장 오래된(큰) 값, 목록 이름은 모두
rows = []
for did, grp in cx.groupby("DAN_ID"):
    grp = grp.sort_values("노후년도", ascending=False)
    r0 = grp.iloc[0]
    names = list(dict.fromkeys([str(x) for x in grp["단지명"].dropna()]))
    rows.append({"geometry": r0.geometry, "id": str(did), "name": str(r0["DAN_NAME"]), "lname": " / ".join(names), "type": str(r0["단지유형"] or r0["DANJI_TYPE"] or ""),
                 "status": str(r0["조성"] or ""), "desig": str(r0["지정일"] or "")[:10], "age": int(r0["노후년도"]) if not (isinstance(r0["노후년도"], float) and math.isnan(r0["노후년도"])) else None,
                 "area": int(r0["dam_area_m2"]) if r0["dam_area_m2"] == r0["dam_area_m2"] else None, "where": str(r0["위치"] or ""), "matched": True, "n_list": int(len(grp))})
um = gpd.read_file(f, layer="DAM_DAN_미매칭경계").to_crs("EPSG:5179")
um = um[um.geometry.intersects(area3)]
for _, r in um.iterrows():
    rows.append({"geometry": r.geometry, "id": str(r["DAN_ID"]), "name": str(r["DAN_NAME"]), "lname": "", "type": str(r["DANJI_TYPE"] or ""), "status": "", "desig": "",
                 "age": None, "area": int(r["dam_area_m2"]) if r["dam_area_m2"] == r["dam_area_m2"] else None, "where": "", "matched": False, "n_list": 0})
cg = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:5179")
# 가장 가까운 역 (경계까지 거리)
stx = st.geometry.values
def nearest(geom):
    d = [geom.distance(p) for p in stx]
    i = int(np.argmin(d)); return stations[i]["name"], round(d[i])
nn = cg.geometry.apply(nearest)
cg["near_st"] = [x[0] for x in nn]; cg["near_m"] = [x[1] for x in nn]
rp = cg.geometry.representative_point().to_crs("EPSG:4326"); cg["lon"] = rp.x.round(6); cg["lat"] = rp.y.round(6)   # 이름표 자리
say("complexes: matched", int(cg["matched"].sum()), "unmatched", int((~cg["matched"]).sum()), "age null", int(cg["age"].isna().sum()))
dump(cg, "complexes.json", ["id", "name", "lname", "type", "status", "desig", "age", "area", "where", "matched", "n_list", "near_st", "near_m", "lon", "lat"], simplify_m=8)

# ── 인구밀도 격자 → WGS84 축의 그림 ───────────────────────
if "--no-pop" in sys.argv: say("pop 건너뜀"); sys.exit(0)
say("pop grid 읽는 중 (1,029,094칸)…")
pop = pyogrio.read_dataframe(os.path.join(SRC, "gpkg", "pop_total.gpkg"), layer="pop_total", columns=["pop_cnt"])
b = pop.geometry.bounds
X0, Y0, X1, Y1 = 900400.0, 1877200.0, 1030800.0, 2031400.0
CELL = 100.0
ncol, nrow = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
col = ((b["minx"].values - X0) / CELL).round().astype(int); row = ((Y1 - b["maxy"].values) / CELL).round().astype(int)
ok = (col >= 0) & (col < ncol) & (row >= 0) & (row < nrow)
grid = np.full((nrow, ncol), np.nan, dtype=np.float32)
grid[row[ok], col[ok]] = pop["pop_cnt"].values[ok]
dens = grid * 100.0                                   # 100m 칸 → 명/㎢
vals = dens[np.isfinite(dens) & (dens > 0)]
say("pop cells", int(np.isfinite(grid).sum()), "populated", vals.size, "sextiles", np.percentile(vals, [16.7, 33.3, 50, 66.7, 83.3]).round())
BREAKS = [1, 1000, 3000, 10000, 25000, 50000]          # 명/㎢ · 6급간 — 인구 있는 칸의 6분위를 둥글린 값 (마지막은 50,000 이상)
GREENS = ["#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"]
cls = np.zeros(dens.shape, dtype=np.uint8)            # 0 = 없음/0명
for i, br in enumerate(BREAKS): cls[np.isfinite(dens) & (dens >= br)] = i + 1
# WGS84 축 그림 — 각 화소의 중심 lon/lat 을 5179 로 옮겨 가장 가까운 칸을 뽑습니다
tr = Transformer.from_crs("EPSG:5179", "EPSG:4326", always_xy=True)
ll = np.array(tr.transform([X0, X1, X0, X1], [Y0, Y0, Y1, Y1])).T
LON0, LON1, LAT0, LAT1 = ll[:, 0].min(), ll[:, 0].max(), ll[:, 1].min(), ll[:, 1].max()
DLON = 0.0011; DLAT = 0.0009                          # 약 100m
W = int((LON1 - LON0) / DLON); H = int((LAT1 - LAT0) / DLAT)
lons = LON0 + (np.arange(W) + 0.5) * DLON; lats = LAT1 - (np.arange(H) + 0.5) * DLAT
back = Transformer.from_crs("EPSG:4326", "EPSG:5179", always_xy=True)
LON, LAT = np.meshgrid(lons, lats)
XX, YY = back.transform(LON.ravel(), LAT.ravel())
cc = ((XX - X0) / CELL).astype(int); rr = ((Y1 - YY) / CELL).astype(int)
inside = (cc >= 0) & (cc < ncol) & (rr >= 0) & (rr < nrow)
img_cls = np.zeros(W * H, dtype=np.uint8); img_cls[inside] = cls[rr[inside], cc[inside]]
img_cls = img_cls.reshape(H, W)
rgba = np.zeros((H, W, 4), dtype=np.uint8)
for i, hexc in enumerate(GREENS):
    m = img_cls == i + 1
    rgba[m, 0] = int(hexc[1:3], 16); rgba[m, 1] = int(hexc[3:5], 16); rgba[m, 2] = int(hexc[5:7], 16); rgba[m, 3] = 235
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "pop_density.png"), optimize=True)
say("pop_density.png", W, "x", H, "%.0f KB" % (os.path.getsize(os.path.join(OUT, "pop_density.png")) / 1024))
# 값 격자 (클릭해 보기) — 그림과 같은 WGS84 축에서 5×5 화소(약 500m)를 평균낸 밀도. 화면은 lon/lat 만으로 칸을 찾습니다
img_d = np.zeros(W * H, dtype=np.float32); img_d[inside] = np.nan_to_num(dens[rr[inside], cc[inside]], nan=0.0)
img_d = img_d.reshape(H, W)
K = 5
H5, W5 = H // K, W // K
d5 = img_d[:H5 * K, :W5 * K].reshape(H5, K, W5, K).mean(axis=(1, 3))
v16 = np.clip(np.round(d5), 0, 65535).astype("<u2")
meta = {"bounds": [[round(LAT0, 6), round(LON0, 6)], [round(LAT1, 6), round(LON1, 6)]], "breaks": BREAKS, "colors": GREENS,
        "labels": ["1~1,000", "1,000~3,000", "3,000~10,000", "10,000~25,000", "25,000~50,000", "50,000 이상"], "unit": "명/㎢ (100m 격자 기준)",
        "grid": {"lon0": round(LON0, 6), "lat1": round(LAT1, 6), "dlon": DLON * K, "dlat": DLAT * K, "ncol": W5, "nrow": H5, "u16_b64": base64.b64encode(v16.tobytes()).decode("ascii"),
                 "note": "약 500m 칸의 평균 밀도(명/㎢). 행 = (lat1 - lat) / dlat, 열 = (lon - lon0) / dlon"},
        "src": "인구 100m 격자(pop_total.gpkg) · 밀도 = 칸 인구 × 100"}
io.open(os.path.join(OUT, "pop_meta.json"), "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
say("pop_meta.json", "%.0f KB" % (os.path.getsize(os.path.join(OUT, "pop_meta.json")) / 1024), "class counts", np.bincount(cls.ravel(), minlength=7).tolist())
say("done")
