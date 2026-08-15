# -*- coding: utf-8 -*-
"""[경기도 방위산업 기업체와 연구장비] 지도 자료 만들기.

원본: D:\\Google_drive_20260726\\1.EDU\\2_geocoding\\1_방산클러스터\\result_data
출력:
  assets/data/defense/points.json          기업·연구장비 좌표와 통계
  assets/img/defense-cluster-card.jpg      목록 카드용 썸네일
"""
import io, json, os, sys, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
SRC = r'D:\Google_drive_20260726\1.EDU\2_geocoding\1_방산클러스터'
DATA = os.path.join(SRC, 'result_data')
SGG_SHP = os.path.join(SRC, 'raw', 'GG_sgg_utmk.shp')
OUTDIR = os.path.join(SITE, 'assets', 'data', 'defense')

CAT_COLORS = {
    '전자/제어/통신/센서': '#2563eb',
    '하드웨어/소재':       '#0891b2',
    '우주/항공/드론':      '#7c3aed',
    'AI/디지털트윈':       '#db2777',
    '반도체':             '#ea580c',
    '로봇':               '#16a34a',
    '기타':               '#78716c',
}
FIELD_LABEL = {'ET': 'ET 환경·에너지', 'BT': 'BT 바이오', 'IT': 'IT 정보통신',
               'NT': 'NT 나노', '기타': '기타', '3D프린터': '3D프린터'}


def csv(name):
    p = os.path.join(DATA, name)
    for enc in ('utf-8-sig', 'cp949'):
        try:
            return pd.read_csv(p, encoding=enc)
        except Exception:
            pass
    raise SystemExit('읽지 못했습니다: ' + p)


def clean(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    s = str(v).strip()
    return s if s and s.lower() != 'nan' else None


def main():
    os.makedirs(OUTDIR, exist_ok=True)

    # ── 1) 방산기업 (경기도 내, 지오코딩 완료) ─────────────────────
    co = csv('16_방산기업_지오코딩.csv')
    co = co[co['lat'].notna() & co['lon'].notna()].copy()
    co['대분류'] = co['대분류'].fillna('기타')
    companies = [{
        'name': clean(r['기업명']),
        'cat': r['대분류'],
        'si': clean(r['si']),
        'sgg': clean(r['sgg']),
        'emd': clean(r['emd']),
        'addr': clean(r['주소_원문']) or clean(r['주소1(경기도)']),
        'lat': round(float(r['lat']), 6),
        'lon': round(float(r['lon']), 6),
    } for _, r in co.iterrows()]
    cat_counts = co['대분류'].value_counts()
    cats = [{'key': k, 'color': CAT_COLORS.get(k, '#78716c'), 'n': int(v)}
            for k, v in cat_counts.items()]
    print(f'  방산기업 {len(companies)}개 · 분류 {len(cats)}종', flush=True)

    # 경기도 밖 본사까지 포함한 전체 명단(참고 통계용)
    allco = csv('28_방산기업_최종_250_gg136.csv')
    in_gg = int((allco['경기도여부'] == 'Y').sum())

    # ── 2) 연구장비 — 주소별 집계 ─────────────────────────────────
    eq = csv('02_주소별_장비수.csv')
    eq = eq[eq['lat'].notna() & eq['lon'].notna()].copy()
    equip = [{
        'addr': clean(r['주소']),
        'org': clean(r['보유기관']),
        'orgs': int(r['보유기관수']) if pd.notna(r['보유기관수']) else None,
        'si': clean(r['소재지']),
        'field': clean(r['대표분야']),
        'n': int(r['장비수']),
        'lat': round(float(r['lat']), 6),
        'lon': round(float(r['lon']), 6),
    } for _, r in eq.iterrows()]
    print(f'  연구장비 보유지점 {len(equip)}곳 · 장비 {int(eq["장비수"].sum()):,}대', flush=True)

    # ── 3) 방산 관련 장비 — 주소별 집계(좌표는 2)에서 붙임) ────────
    dq = csv('11_방산관련_주소별_집계.csv').merge(
        eq[['주소', 'lat', 'lon', '소재지']], on='주소', how='left')
    dq = dq[dq['lat'].notna()].copy()
    catcols = [c for c in dq.columns if len(c) > 2 and c[1] == '.' and c[0] in 'ABCDEFG']
    defense = [{
        'addr': clean(r['주소']),
        'org': clean(r['보유기관']),
        'cat': clean(r['대표카테고리']),
        'si': clean(r['소재지']),
        'n': int(r['방산장비수']),
        'by': {c: int(r[c]) for c in catcols if int(r[c]) > 0},
        'lat': round(float(r['lat']), 6),
        'lon': round(float(r['lon']), 6),
    } for _, r in dq.iterrows()]
    print(f'  방산관련 장비 보유지점 {len(defense)}곳 · 장비 {int(dq["방산장비수"].sum()):,}대', flush=True)

    # ── 4) 통계 ──────────────────────────────────────────────────
    by_si_co = co['si'].value_counts()
    by_si_eq = eq.groupby('소재지')['장비수'].sum().sort_values(ascending=False)
    sis = list(dict.fromkeys(list(by_si_co.index) + list(by_si_eq.index)))
    by_si = [{'si': s, 'co': int(by_si_co.get(s, 0)), 'eq': int(by_si_eq.get(s, 0))}
             for s in sis]
    by_si.sort(key=lambda x: (-x['co'], -x['eq']))

    by_field = [{'key': k, 'label': FIELD_LABEL.get(k, k), 'n': int(v)}
                for k, v in eq.groupby('대표분야')['장비수'].sum().sort_values(ascending=False).items()]
    by_dcat = [{'key': k, 'n': int(v)} for k, v in
               dq.groupby('대표카테고리')['방산장비수'].sum().sort_values(ascending=False).items()]

    doc = {
        'companies': {
            'label': '경기도 방위산업 기업체(본사 기준)',
            'note': '수도권 방산리스트에서 경기도 내 본사를 추려 주소를 지오코딩한 자료. '
                    f'전체 명단 {len(allco)}개사 중 경기도 소재 {in_gg}개사.',
            'n': len(companies), 'cats': cats, 'items': companies,
        },
        'equip': {
            'label': '경기도 연구장비 보유기관',
            'note': '2025 경기도 연구장비 전체 데이터를 주소 단위로 묶은 자료. 원의 크기가 장비 수입니다.',
            'n': len(equip), 'total': int(eq['장비수'].sum()), 'items': equip,
        },
        'defense': {
            'label': '방위산업 관련 연구장비',
            'note': '환경내구성·전자파(EMC)·구조재료·열영상 등 방산 시험에 쓰일 수 있는 장비를 추린 것입니다.',
            'n': len(defense), 'total': int(dq['방산장비수'].sum()), 'items': defense,
        },
        'stats': {'bySi': by_si, 'byField': by_field, 'byDefenseCat': by_dcat},
    }
    p = os.path.join(OUTDIR, 'points.json')
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('  ', p, f'{os.path.getsize(p)/1024:.0f} KB', flush=True)

    make_card(co, eq)


def make_card(co, eq):
    import geopandas as gpd
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib import font_manager, rc
    for cand in ['c:/Windows/Fonts/malgun.ttf', 'c:/Windows/Fonts/gulim.ttc']:
        if os.path.exists(cand):
            rc('font', family=font_manager.FontProperties(fname=cand).get_name())
            break
    rc('axes', unicode_minus=False)

    gg = gpd.read_file(SGG_SHP, engine='pyogrio').to_crs('EPSG:4326')

    fig, ax = plt.subplots(figsize=(6, 6), dpi=170)
    fig.patch.set_facecolor('#eef2f5'); ax.set_facecolor('#eef2f5')
    gg.plot(ax=ax, facecolor='#dfe6ea', edgecolor='#b6c1c7', linewidth=0.6)
    ax.scatter(eq['lon'], eq['lat'], s=np.sqrt(eq['장비수']) * 9,
               c='#f59e0b', alpha=0.55, edgecolors='#92400e', linewidths=0.4, zorder=3)
    for cat, sub in co.groupby('대분류'):
        ax.scatter(sub['lon'], sub['lat'], s=13, c=CAT_COLORS.get(cat, '#78716c'),
                   edgecolors='white', linewidths=0.3, zorder=4)
    ax.set_aspect(1 / np.cos(np.deg2rad(37.4)))
    ax.set_axis_off()
    b = gg.total_bounds
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    half = max(b[2] - b[0], b[3] - b[1]) / 2 * 0.92
    ax.set_xlim(cx - half, cx + half); ax.set_ylim(cy - half * 0.96, cy + half * 0.96)
    fig.subplots_adjust(0, 0, 1, 1)
    out = os.path.join(SITE, 'assets', 'img', 'defense-cluster-card.jpg')
    fig.savefig(out, facecolor='#eef2f5', pad_inches=0); plt.close(fig)
    print('  카드 이미지:', out, flush=True)


if __name__ == '__main__':
    main()
