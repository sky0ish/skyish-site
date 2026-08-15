# -*- coding: utf-8 -*-
"""지도 ② 의 참고 레이어 — 경기도 재해위험 구역(로컬 SHP) → GeoJSON.

침수흔적도 자체는 지도 ①이 이미 읽는 assets/data/flood/source-<src>.json 의
폴리곤을 그대로 다시 쓰므로(경기도 6,730개), 여기서는 참고 레이어만 만듭니다.

출력: assets/data/flood/gg-ref-layers.json
"""
import io, json, os, sys, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import geopandas as gpd

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(SITE, 'assets', 'data', 'flood', 'gg-ref-layers.json')
WORK_CRS = 'EPSG:5179'
SIMPLIFY_M = 3.0

RISK_GG  = r'D:\0.GIS\1GIS_침수흔적도\202308_자연재해_재해위험지구\자연재해_재해위험지구_경기\LSMD_CONT_UP201_41_202308.shp'
STEEP_GG = r'D:\0.GIS\1GIS_침수흔적도\202308_급경사재해예방_붕괴위험지역\급경사재해예방_붕괴위험지역-경기\LSMD_CONT_UP401_41_202308.shp'


def to_geojson(gdf, fields):
    g = gdf.to_crs(WORK_CRS)
    g['geometry'] = g.geometry.buffer(0).simplify(SIMPLIFY_M, preserve_topology=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].to_crs('EPSG:4326')
    g = g[[c for c in fields if c in g.columns] + ['geometry']]
    doc = json.loads(g.to_json(drop_id=True))
    for f in doc['features']:
        f['properties'] = {k: v for k, v in (f['properties'] or {}).items()
                           if v is not None and v == v and v != ''}
    return round_coords(doc)


def round_coords(obj, nd=5):
    if isinstance(obj, list):
        if obj and isinstance(obj[0], (int, float)):
            return [round(v, nd) for v in obj]
        return [round_coords(v, nd) for v in obj]
    if isinstance(obj, dict):
        return {k: (round_coords(v, nd) if isinstance(v, (list, dict)) else v)
                for k, v in obj.items()}
    return obj


def main():
    layers = []

    risk = gpd.read_file(RISK_GG, engine='pyogrio', encoding='cp949')
    risk = risk.rename(columns={'ALIAS': 'name', 'NTFDATE': 'ymd', 'COL_ADM_SE': 'sgg_cd'})
    layers.append({
        'id': 'gg-risk-zone', 'label': '자연재해 위험개선지구(경기)',
        'color': '#16a34a', 'count': int(len(risk)), 'default': False,
        'geojson': to_geojson(risk, ['name', 'ymd', 'sgg_cd']),
    })
    print(f'  자연재해 위험개선지구(경기): {len(risk):,}', flush=True)

    st = gpd.read_file(STEEP_GG, engine='pyogrio', encoding='cp949')
    st = st.rename(columns={'ALIAS': 'name', 'NTFDATE': 'ymd', 'COL_ADM_SE': 'sgg_cd'})
    layers.append({
        'id': 'gg-steep-zone', 'label': '급경사지 붕괴위험지역(경기)',
        'color': '#a16207', 'count': int(len(st)), 'default': False,
        'geojson': to_geojson(st, ['name', 'ymd', 'sgg_cd']),
    })
    print(f'  급경사지 붕괴위험지역(경기): {len(st):,}', flush=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'simplifyM': SIMPLIFY_M, 'layers': layers},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('saved', OUT, f'{os.path.getsize(OUT)/1024:.0f} KB', flush=True)


if __name__ == '__main__':
    main()
