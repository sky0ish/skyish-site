# -*- coding: utf-8 -*-
"""[경기도 방위산업 기업체와 연구장비] 네트워크 자료 만들기.

기업(노드) ↔ 연구장비 보유기관(노드) 사이의 '장비 활용 가능성' 연결(엣지)을 만든다.

  연결 기준 = ① 분야 적합성 + ② 근접성
    ① 기업의 대분류가 필요로 할 시험·계측 유형(A~G)을 가진 기관만 후보
    ② 그 후보 중 가까운 순으로 K곳까지 연결

  ※ 실제 거래·납품 실적이 아니라 '이 기업이 쓸 만한 장비가 어디 있는가'를
    분야와 거리로 추정한 것이다. 화면에도 그렇게 밝힌다.

원본: D:\\Google_drive_20260726\\1.EDU\\2_geocoding\\1_방산클러스터\\result_data
출력: assets/data/defense/network.json
"""
import io, json, math, os, sys, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
DATA = r'D:\Google_drive_20260726\1.EDU\2_geocoding\1_방산클러스터\result_data'
OUTDIR = os.path.join(SITE, 'assets', 'data', 'defense')

K = 3                      # 기업 한 곳이 연결할 장비 기관 수 (가까운 순)
MAX_KM = 60                # 이보다 먼 연결은 만들지 않는다

CATS = ['A. 방산·군수 명시', 'B. 환경내구성 시험', 'C. 전자파·EMC 시험',
        'D. 구조·재료 내구시험', 'E. 열영상·광학 센서',
        'F. 비파괴검사·정밀계측', 'G. 전산해석·시뮬레이션']

# 원본 대분류 13종 → 화면 표시용 7종 (기존 지도와 색을 맞추기 위함)
CAT_MAP = {
    '전자/제어/통신/센서': '전자/제어/통신/센서',
    '하드웨어': '하드웨어/소재', '소재': '하드웨어/소재',
    '우주/항공/드론': '우주/항공/드론', '드론': '우주/항공/드론', '우주/항공': '우주/항공/드론',
    'AI': 'AI/디지털트윈', '디지털트윈': 'AI/디지털트윈',
    '반도체': '반도체', '로봇': '로봇',
    '기타': '기타', '시험/인증': '기타', '에너지': '기타',
}
CAT_COLORS = {
    '전자/제어/통신/센서': '#38bdf8',
    '하드웨어/소재': '#a3e635',
    '우주/항공/드론': '#c084fc',
    'AI/디지털트윈': '#f472b6',
    '반도체': '#fb923c',
    '로봇': '#34d399',
    '기타': '#94a3b8',
}
# 기업 분야(원본 13종)가 필요로 할 시험·계측 유형
NEED = {
    '전자/제어/통신/센서': ['C. 전자파·EMC 시험', 'E. 열영상·광학 센서', 'B. 환경내구성 시험'],
    '우주/항공/드론': ['B. 환경내구성 시험', 'D. 구조·재료 내구시험', 'G. 전산해석·시뮬레이션'],
    '우주/항공': ['B. 환경내구성 시험', 'D. 구조·재료 내구시험', 'G. 전산해석·시뮬레이션'],
    '드론': ['B. 환경내구성 시험', 'D. 구조·재료 내구시험', 'C. 전자파·EMC 시험'],
    '하드웨어': ['D. 구조·재료 내구시험', 'F. 비파괴검사·정밀계측', 'B. 환경내구성 시험'],
    '소재': ['D. 구조·재료 내구시험', 'F. 비파괴검사·정밀계측'],
    '반도체': ['C. 전자파·EMC 시험', 'F. 비파괴검사·정밀계측'],
    '로봇': ['D. 구조·재료 내구시험', 'C. 전자파·EMC 시험'],
    'AI': ['G. 전산해석·시뮬레이션', 'C. 전자파·EMC 시험'],
    '디지털트윈': ['G. 전산해석·시뮬레이션'],
    '에너지': ['B. 환경내구성 시험', 'D. 구조·재료 내구시험'],
    '시험/인증': ['A. 방산·군수 명시', 'F. 비파괴검사·정밀계측'],
    '기타': ['A. 방산·군수 명시', 'B. 환경내구성 시험'],
}


def csv(name):
    p = os.path.join(DATA, name)
    for enc in ('utf-8-sig', 'cp949'):
        try:
            return pd.read_csv(p, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise SystemExit('읽지 못했습니다: ' + p)


def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = str(v).strip()
    return s if s and s.lower() != 'nan' else None


def km(lat1, lon1, lat2, lon2):
    """경기도 규모에서 충분한 정확도의 평면 근사(km)."""
    k = math.cos(math.radians(37.4))
    return math.hypot((lat1 - lat2) * 111.32, (lon1 - lon2) * 111.32 * k)


def main():
    os.makedirs(OUTDIR, exist_ok=True)

    # ── 1) 기업 — 경기도 사업장이 확인된 곳만 ──────────────────────
    co = csv('28_방산기업_최종_250_gg136.csv')
    co = co[(co['경기도여부'] == 'Y') & co['위도'].notna() & co['경도'].notna()].copy()
    raw_col = [c for c in co.columns if c.startswith('대분류')][0]
    co['원분야'] = co[raw_col].fillna('기타').astype(str).str.strip()
    co['분야'] = co['원분야'].map(lambda v: CAT_MAP.get(v, '기타'))
    co = co.reset_index(drop=True)
    print(f'  기업 {len(co)}개사 (경기도 사업장 기준)', flush=True)

    # ── 2) 연구장비 — 방산 관련, 주소 단위 + 좌표 ─────────────────
    eq_xy = csv('02_주소별_장비수.csv')[['주소', 'lat', 'lon', '소재지']]
    dq = csv('11_방산관련_주소별_집계.csv').merge(eq_xy, on='주소', how='left')
    dq = dq[dq['lat'].notna()].copy().reset_index(drop=True)
    have = [c for c in CATS if c in dq.columns]
    print(f'  연구장비 기관 {len(dq)}곳 · 방산 관련 {int(dq["방산장비수"].sum())}대', flush=True)

    # ── 3) 노드 ──────────────────────────────────────────────────
    companies = [{
        'id': 'c%d' % i,
        'name': clean(r['기업명']),
        'cat': r['분야'],
        'rawCat': r['원분야'],
        'addr': clean(r.get('주소1(경기도)')) or clean(r.get('대표주소')),
        'si': clean(r.get('본사 소재지 (시/군)')),
        'lat': round(float(r['위도']), 6),
        'lon': round(float(r['경도']), 6),
    } for i, r in co.iterrows()]

    sites = [{
        'id': 's%d' % i,
        'name': clean(r['보유기관']),
        'addr': clean(r['주소']),
        'si': clean(r['소재지']),
        # 경기도 밖 기관(서울 강서·마포 등)도 남긴다 — 접경 기업에게는 실제로 가깝다
        'gg': 'Y' if str(r['주소']).strip().startswith('경기') else 'N',
        'n': int(r['방산장비수']),
        'by': {c: int(r[c]) for c in have if int(r[c]) > 0},
        'lat': round(float(r['lat']), 6),
        'lon': round(float(r['lon']), 6),
    } for i, r in dq.iterrows()]

    # ── 4) 엣지 — 분야 적합 + 가까운 순 K곳 ───────────────────────
    slat = np.array([s['lat'] for s in sites])
    slon = np.array([s['lon'] for s in sites])
    edges = []
    for c, row in zip(companies, co.itertuples()):
        need = NEED.get(c['rawCat'], NEED['기타'])
        fit = [j for j, s in enumerate(sites)
               if any(s['by'].get(t) for t in need)]
        if not fit:
            continue
        d = [(km(c['lat'], c['lon'], slat[j], slon[j]), j) for j in fit]
        d.sort()
        for dist, j in d[:K]:
            if dist > MAX_KM:
                continue
            s = sites[j]
            edges.append({
                'c': c['id'], 's': s['id'],
                'km': round(dist, 1),
                'why': [t[0] for t in need if s['by'].get(t)],   # 'B','C' …
                'n': int(sum(s['by'].get(t, 0) for t in need)),
            })

    deg_c, deg_s = {}, {}
    for e in edges:
        deg_c[e['c']] = deg_c.get(e['c'], 0) + 1
        deg_s[e['s']] = deg_s.get(e['s'], 0) + 1
    for c in companies:
        c['deg'] = deg_c.get(c['id'], 0)
    for s in sites:
        s['deg'] = deg_s.get(s['id'], 0)

    linked_co = sum(1 for c in companies if c['deg'])
    linked_st = sum(1 for s in sites if s['deg'])
    out_gg = sum(1 for s in sites if s['deg'] and s['gg'] == 'N')
    dists = [e['km'] for e in edges]
    print(f'  연결 {len(edges)}개 · 기업 {linked_co}개사 · 기관 {linked_st}곳'
          f' (이 중 경기도 밖 {out_gg}곳)', flush=True)
    print(f'  거리 중앙값 {np.median(dists):.1f}km / 최대 {max(dists):.1f}km', flush=True)

    cat_counts = co['분야'].value_counts()
    doc = {
        'meta': {
            'label': '방산기업 × 연구장비 네트워크',
            'note': '기업의 분야가 필요로 할 시험·계측 장비를 가진 기관을, 가까운 순으로 '
                    f'최대 {K}곳까지 이었습니다. 실제 거래·납품 실적이 아니라 '
                    '분야 적합성과 거리로 추정한 연결입니다. 경기도와 붙어 있는 '
                    '서울 소재 기관도 접근 가능한 곳으로 함께 넣었습니다.',
            'k': K, 'maxKm': MAX_KM,
            'nCo': len(companies), 'nSite': len(sites), 'nEdge': len(edges),
            'linkedCo': linked_co, 'linkedSite': linked_st, 'outGg': out_gg,
            'medianKm': round(float(np.median(dists)), 1),
        },
        'cats': [{'key': k, 'color': CAT_COLORS.get(k, '#94a3b8'), 'n': int(v)}
                 for k, v in cat_counts.items()],
        'catNeed': {k: [t[0] for t in v] for k, v in NEED.items()},
        'catLabel': {c[0]: c[3:] for c in CATS},
        'companies': companies,
        'sites': sites,
        'edges': edges,
    }
    p = os.path.join(OUTDIR, 'network.json')
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('  ', p, f'{os.path.getsize(p)/1024:.0f} KB', flush=True)

    top = sorted(sites, key=lambda s: -s['deg'])[:8]
    print('\n  연결이 많은 기관')
    for s in top:
        print(f'    {s["deg"]:>3}건  {s["name"]} ({s["si"]})')


if __name__ == '__main__':
    main()
