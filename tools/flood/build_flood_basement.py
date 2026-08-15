# -*- coding: utf-8 -*-
"""침수흔적도 × 반지하 분석 파이프라인.

출력
  <site>/assets/data/flood/basement-points.json   반지하 좌표(정수 인코딩) — 출처와 무관하게 1회만
  <site>/assets/data/flood/source-<src>.json      침수흔적 폴리곤 + 데이터셋별 내부/외부 플래그 + 통계
  <scratch>/fig_map_<src>.png, fig_pie_<src>.png  정적 그림(썸네일용)

출처(src)
  mois     행정안전부_침수흔적도 (safetydata.go.kr DSSP-IF-00117) — API 수집분
  safemap  사용자가 내려받은 경기도 침수흔적도 SHP (경로를 --shp 로 지정)
"""
import argparse, io, json, os, sys, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely import wkt

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.path.join(HERE, 'cache')          # 원본 캐시 + 정적 그림 보관 (저장소 제외)
SITE = os.path.dirname(os.path.dirname(HERE))  # 사이트 루트
OUTDIR = os.path.join(SITE, 'assets', 'data', 'flood')
os.makedirs(SCRATCH, exist_ok=True)

GG_CTPV = '41'          # 경기도 시도코드
WORK_CRS = 'EPSG:5179'  # 면적·포함관계 판정용 (UTM-K)

# ── 반지하 데이터셋 정의 ─────────────────────────────────────────
DATASETS = {
    'est': {
        'key': 'est',
        'label': '반지하 주택 추정치(건축물대장 층별개요)',
        'short': '반지하 추정치',
        'path': r'D:\0.DATA\4.반지하\건축물대장_층별개요\SHP\반지하추정치_GG_wgs.shp',
        'sgg_col': 'SIGUGUN',
        'note': '국토교통부 건축물대장 층별개요(2023.07)에서 지하층이 있는 주택(단독·다가구·다세대·연립·다중)을 추출해 주소 지오코딩한 자료',
    },
    'srv': {
        'key': 'srv',
        'label': '침수우려 반지하 실태조사(경기도 건축디자인과)',
        'short': '침수우려 실태조사',
        'path': r'D:\0.DATA\4.반지하\1_경기도침수데이터_건축디자인과\SHP\반지하침수데이터_건축디자인과_wgs.shp',
        'sgg_col': 'SIGUGUN',
        'note': '경기도가 2022~2023년 우선조사 대상으로 현장 조사한 침수우려 지하주택',
    },
}


def load_points():
    """반지하 포인트를 모두 읽어 하나의 좌표 테이블로 만든다."""
    frames = {}
    for key, d in DATASETS.items():
        g = gpd.read_file(d['path'], engine='pyogrio')
        g = g.set_crs('EPSG:4326', allow_override=True)
        x = g.geometry.x.to_numpy(dtype=float)
        y = g.geometry.y.to_numpy(dtype=float)
        ok = np.isfinite(x) & np.isfinite(y) & (x > 124) & (x < 132) & (y > 33) & (y < 39)
        sgg = g[d['sgg_col']].astype('string').fillna('미상').to_numpy()
        df = pd.DataFrame({'lon': x[ok], 'lat': y[ok], 'sgg': sgg[ok]})
        print(f"  {key}: {len(g):,} → 유효 {len(df):,}", flush=True)
        frames[key] = df
    return frames


def load_flood_mois():
    """행정안전부 침수흔적도 API 수집분 → 경기도 폴리곤 GeoDataFrame."""
    raw = json.load(open(os.path.join(SCRATCH, 'mois_flood_raw.json'), encoding='utf-8'))
    rows = [r for r in raw if str(r.get('STDG_CTPV_CD')) == GG_CTPV and r.get('GEOM')]
    print(f"  행안부 전국 {len(raw):,}건 → 경기도 {len(rows):,}건", flush=True)
    geoms, recs = [], []
    for r in rows:
        try:
            geoms.append(wkt.loads(r['GEOM']))
        except Exception:
            continue
        recs.append({
            'sgg_cd': r.get('STDG_SGG_CD'),
            'year': r.get('FLDN_YR'),
            'disaster': r.get('FLDN_DST_NM'),
            'cause': r.get('FLDN_CS_DTL_NM'),
            'grade': r.get('FLDN_GRD'),
            'depth': r.get('FLDN_DOWA'),
            'area': r.get('FLDN_AREA'),
        })
    g = gpd.GeoDataFrame(recs, geometry=geoms, crs='EPSG:3857')
    return g.to_crs('EPSG:4326')


def load_flood_shp(path):
    g = gpd.read_file(path, engine='pyogrio')
    if g.crs is None:
        raise SystemExit('SHP 에 좌표계 정보(.prj)가 없습니다. 좌표계를 알려주세요.')
    g = g.to_crs('EPSG:4326')
    # 경기도 범위로 대략 자르기
    return g


# ── 지도 ②의 구분 기준 ────────────────────────────────────────
# 폴리곤에는 밴드 id 를 속성으로 심고, 반지하 점에는 "어느 밴드에 들어갔는지"를
# 한 글자(밴드 번호, 밖이면 '.')로 기록해 브라우저에서 즉시 재집계할 수 있게 한다.
BAND_SPEC = {
    'depth': {
        'label': '침수심',
        'bands': [
            {'id': 'd0', 'label': '0.5 m 미만', 'color': '#93c5fd'},
            {'id': 'd1', 'label': '0.5 – 1 m',  'color': '#60a5fa'},
            {'id': 'd2', 'label': '1 – 2 m',    'color': '#2563eb'},
            {'id': 'd3', 'label': '2 m 이상',   'color': '#1e3a8a'},
            {'id': 'dx', 'label': '미상',       'color': '#94a3b8'},
        ],
    },
    'year': {
        'label': '침수 시기',
        'bands': [
            {'id': 'y0', 'label': '2009년 이전',  'color': '#c7d2fe'},
            {'id': 'y1', 'label': '2010 – 2014', 'color': '#818cf8'},
            {'id': 'y2', 'label': '2015 – 2019', 'color': '#4f46e5'},
            {'id': 'y3', 'label': '2020 – 2022', 'color': '#312e81'},
            {'id': 'yx', 'label': '미상',        'color': '#94a3b8'},
        ],
    },
}
UNKNOWN = 4   # 두 기준 모두 마지막이 '미상'


def depth_band(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return UNKNOWN
    if v != v:
        return UNKNOWN
    return 0 if v < 0.5 else 1 if v < 1 else 2 if v < 2 else 3


def year_band(v):
    try:
        v = int(str(v)[:4])
    except (TypeError, ValueError):
        return UNKNOWN
    if not v:
        return UNKNOWN
    return 0 if v <= 2009 else 1 if v <= 2014 else 2 if v <= 2019 else 3


def add_bands(flood):
    """폴리곤에 밴드 번호(db/yb)를 붙인다. depth/year 열이 없으면 '미상'."""
    d = flood['depth'] if 'depth' in flood.columns else pd.Series([None] * len(flood))
    y = flood['year'] if 'year' in flood.columns else pd.Series([None] * len(flood))
    flood = flood.copy()
    flood['db'] = [depth_band(v) for v in d]
    flood['yb'] = [year_band(v) for v in y]
    return flood


def analyse(flood_wgs, frames):
    flood = flood_wgs.to_crs(WORK_CRS)
    flood = flood[flood.geometry.notna() & ~flood.geometry.is_empty].copy()
    flood['geometry'] = flood.geometry.buffer(0)
    union_idx = flood.sindex
    db = flood['db'].to_numpy()
    yb = flood['yb'].to_numpy()

    out = {}
    for key, df in frames.items():
        pts = gpd.GeoDataFrame(
            df, geometry=gpd.points_from_xy(df['lon'], df['lat']), crs='EPSG:4326'
        ).to_crs(WORK_CRS)
        hit = np.zeros(len(pts), dtype=bool)
        li, ri = union_idx.query(pts.geometry, predicate='within')
        hit[li] = True

        # 한 점이 여러 폴리곤에 걸치면 더 깊은 쪽 / 더 최근 쪽을 대표로 삼는다.
        # 우선순위: 실제 구간(0~3) → 1~4, '미상'(4) → 0. 최대값을 취한 뒤 되돌린다.
        def represent(band_of_poly):
            prio = np.where(band_of_poly == UNKNOWN, 0, band_of_poly + 1)
            best = np.zeros(len(pts), dtype=np.int16)
            np.maximum.at(best, li, prio[ri])
            band = np.where(best > 0, best - 1, UNKNOWN)
            return np.where(hit, band, -1).astype(np.int8)   # -1 = 흔적도 밖

        pt_db = represent(db)
        pt_yb = represent(yb)
        inside = int(hit.sum())
        n = len(pts)
        by_sgg = (
            pd.DataFrame({'sgg': df['sgg'].to_numpy(), 'in': hit})
            .groupby('sgg', as_index=False)
            .agg(total=('in', 'size'), inside=('in', 'sum'))
            .sort_values('inside', ascending=False)
        )
        out[key] = {
            'flags': hit,
            'bands': {'depth': pt_db, 'year': pt_yb},
            'byBand': {
                grp: [int((arr == i).sum()) for i in range(len(BAND_SPEC[grp]['bands']))]
                for grp, arr in (('depth', pt_db), ('year', pt_yb))
            },
            'stats': {
                'total': n,
                'inside': inside,
                'outside': n - inside,
                'ratio': round(inside / n * 100, 2) if n else 0.0,
            },
            'bySgg': [
                {'sgg': r.sgg, 'total': int(r.total), 'inside': int(r.inside),
                 'ratio': round(r.inside / r.total * 100, 2) if r.total else 0.0}
                for r in by_sgg.itertuples()
            ],
        }
        print(f"  {key}: {inside:,} / {n:,} = {out[key]['stats']['ratio']}% 흔적도 내부", flush=True)
    return out


def encode_points(frames):
    """좌표를 정수(1e-5도 단위 오프셋)로 인코딩해 파일 크기를 줄인다."""
    all_lon = np.concatenate([f['lon'].to_numpy() for f in frames.values()])
    all_lat = np.concatenate([f['lat'].to_numpy() for f in frames.values()])
    lon0, lat0 = float(all_lon.min()), float(all_lat.min())
    doc = {'scale': 100000, 'lon0': round(lon0, 6), 'lat0': round(lat0, 6), 'sets': {}}
    for key, df in frames.items():
        sgg_names = sorted(df['sgg'].unique().tolist())
        sgg_idx = {s: i for i, s in enumerate(sgg_names)}
        doc['sets'][key] = {
            'label': DATASETS[key]['label'],
            'short': DATASETS[key]['short'],
            'note': DATASETS[key]['note'],
            'n': len(df),
            'sgg': sgg_names,
            'x': np.rint((df['lon'].to_numpy() - lon0) * 1e5).astype(int).tolist(),
            'y': np.rint((df['lat'].to_numpy() - lat0) * 1e5).astype(int).tolist(),
            'g': [sgg_idx[s] for s in df['sgg']],
        }
    return doc


def simplify_polygons(flood_wgs, tol_m=8):
    g = flood_wgs.to_crs(WORK_CRS)
    g['geometry'] = g.geometry.buffer(0).simplify(tol_m, preserve_topology=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty]
    g = g.to_crs('EPSG:4326')
    if hasattr(g.geometry, 'set_precision'):
        # 좌표 정밀도를 낮추면 아주 작은 폴리곤은 비어 버리므로 한 번 더 걸러 낸다
        g['geometry'] = g.geometry.set_precision(1e-5)
        g = g[g.geometry.notna() & ~g.geometry.is_empty]
    return g


def make_figures(flood_wgs, frames, results, src, label):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib import font_manager, rc
    for cand in ['c:/Windows/Fonts/malgun.ttf', 'c:/Windows/Fonts/gulim.ttc']:
        if os.path.exists(cand):
            rc('font', family=font_manager.FontProperties(fname=cand).get_name())
            break
    rc('axes', unicode_minus=False)

    key = 'est'
    df = frames[key]
    hit = results[key]['flags']
    st = results[key]['stats']

    fig, ax = plt.subplots(figsize=(9, 9), dpi=140)
    flood_wgs.plot(ax=ax, facecolor='#3b82f6', edgecolor='#1d4ed8', alpha=0.35, linewidth=0.3)
    ax.scatter(df['lon'][~hit], df['lat'][~hit], s=0.7, c='#111111', linewidths=0, label=f'흔적도 밖 ({st["outside"]:,})')
    ax.scatter(df['lon'][hit], df['lat'][hit], s=3.2, c='#facc15', edgecolors='#7c5b00',
               linewidths=0.15, label=f'흔적도 안 ({st["inside"]:,})')
    ax.set_aspect(1 / np.cos(np.deg2rad(37.4)))
    ax.set_title(f'경기도 반지하 주택과 침수흔적도\n({label})', fontsize=14)
    ax.set_xlabel('경도'); ax.set_ylabel('위도')
    ax.legend(loc='upper right', markerscale=6, framealpha=0.9)
    fig.tight_layout()
    p1 = os.path.join(SCRATCH, f'fig_map_{src}.png')
    fig.savefig(p1); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 6), dpi=140)
    vals = [st['inside'], st['outside']]
    ax.pie(vals, labels=['침수흔적도 내', '침수흔적도 외'],
           colors=['#facc15', '#2b2b2b'], autopct=lambda p: f'{p:.1f}%\n({int(round(p*sum(vals)/100)):,})',
           startangle=90, counterclock=False, textprops={'color': '#111', 'fontsize': 11},
           wedgeprops={'edgecolor': 'white', 'linewidth': 1.5})
    ax.set_title(f'반지하 {st["total"]:,}호 중 침수흔적도 내 비율\n({label})', fontsize=13)
    fig.tight_layout()
    p2 = os.path.join(SCRATCH, f'fig_pie_{src}.png')
    fig.savefig(p2); plt.close(fig)

    # 목록(pictures.html) 카드용 — 축·제목 없는 정사각 썸네일
    fig, ax = plt.subplots(figsize=(6, 6), dpi=170)
    fig.patch.set_facecolor('#eef2f5'); ax.set_facecolor('#eef2f5')
    flood_wgs.plot(ax=ax, facecolor='#3b82f6', edgecolor='#1d4ed8', alpha=0.45, linewidth=0.25)
    ax.scatter(df['lon'][~hit], df['lat'][~hit], s=0.5, c='#111111', linewidths=0)
    ax.scatter(df['lon'][hit], df['lat'][hit], s=2.6, c='#facc15', linewidths=0)
    ax.set_aspect(1 / np.cos(np.deg2rad(37.4)))
    lo, la = df['lon'], df['lat']
    cx, cy = (lo.min() + lo.max()) / 2, (la.min() + la.max()) / 2
    half = max(lo.max() - lo.min(), (la.max() - la.min())) / 2 * 0.62
    ax.set_xlim(cx - half, cx + half); ax.set_ylim(cy - half * 0.92, cy + half * 0.92)
    ax.set_axis_off()
    fig.subplots_adjust(0, 0, 1, 1)
    p3 = os.path.join(SITE, 'assets', 'img', f'flood-basement-card.jpg')
    fig.savefig(p3, facecolor='#eef2f5', pad_inches=0); plt.close(fig)
    print('  그림 저장:', p1, p2, p3, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='mois', choices=['mois', 'safemap'])
    ap.add_argument('--shp', default=None, help='safemap(사용자 SHP) 경로')
    ap.add_argument('--label', default=None)
    ap.add_argument('--skip-points', action='store_true')
    args = ap.parse_args()

    os.makedirs(OUTDIR, exist_ok=True)

    print('1) 반지하 포인트 로드', flush=True)
    frames = load_points()

    print('2) 침수흔적도 로드', flush=True)
    if args.src == 'mois':
        flood = load_flood_mois()
        label = args.label or '행정안전부 침수흔적도 (safetydata.go.kr)'
    else:
        if not args.shp:
            raise SystemExit('--shp 경로가 필요합니다.')
        flood = load_flood_shp(args.shp)
        label = args.label or '침수흔적도 SHP'
    print(f"  폴리곤 {len(flood):,}개", flush=True)

    print('3) 포함관계 판정', flush=True)
    flood = add_bands(flood)
    results = analyse(flood, frames)

    print('4) 파일 출력', flush=True)
    if not args.skip_points:
        pts_doc = encode_points(frames)
        p = os.path.join(OUTDIR, 'basement-points.json')
        json.dump(pts_doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('  ', p, f'{os.path.getsize(p)/1e6:.2f} MB', flush=True)

    simp = simplify_polygons(flood)
    geo = json.loads(simp.to_json(drop_id=True))
    for f in geo['features']:
        f['properties'] = {k: v for k, v in (f['properties'] or {}).items() if v is not None}

    years = sorted({str(y) for y in flood.get('year', pd.Series(dtype=str)).dropna().unique()}) \
        if 'year' in flood.columns else []
    doc = {
        'src': args.src,
        'label': label,
        'polygonCount': int(len(simp)),
        'years': years,
        'stats': {k: v['stats'] for k, v in results.items()},
        'bySgg': {k: v['bySgg'] for k, v in results.items()},
        'flags': {k: ''.join('1' if b else '0' for b in v['flags']) for k, v in results.items()},
        # 지도 ② — 밴드 정의와, 반지하 점마다 걸린 밴드 번호('.' = 흔적도 밖)
        'bandSpec': BAND_SPEC,
        'bandFlags': {
            grp: {k: ''.join('.' if b < 0 else str(int(b)) for b in v['bands'][grp])
                  for k, v in results.items()}
            for grp in BAND_SPEC
        },
        'byBand': {k: v['byBand'] for k, v in results.items()},
        'geojson': geo,
    }
    p = os.path.join(OUTDIR, f'source-{args.src}.json')
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('  ', p, f'{os.path.getsize(p)/1e6:.2f} MB', flush=True)

    print('5) 정적 그림', flush=True)
    make_figures(flood, frames, results, args.src, label)


if __name__ == '__main__':
    main()
