# -*- coding: utf-8 -*-
"""[경기도 방산기업정보] 단독 폴더 만들기.

홈페이지에 얹기 전에 그 자체로 열어볼 수 있는 결과물 묶음을 만든다.
자료를 HTML 안에 박아 넣으므로 웹서버 없이 index.html 을 더블클릭해도 열린다.

먼저 실행할 것:
  python tools/defense/build_defense_map.py       (points.json)
  python tools/defense/build_defense_network.py   (network.json)

출력: 경기도 방산기업정보/
  index.html                       네트워크 지도 (자료 내장, 단독 실행)
  data/network.json                노드·엣지 원자료
  data/방산기업_136.csv             기업 명단
  data/연구장비기관_51.csv           연구장비 보유기관
  data/기업-장비_연결_408.csv        연결(엣지) 목록
  vendor/leaflet/                  지도 라이브러리 (오프라인용 복사본)
  README.md
"""
import io, json, os, shutil, sys, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(SITE, '경기도 방산기업정보')

NET_JSON = os.path.join(SITE, 'assets', 'data', 'defense', 'network.json')
NET_JS = os.path.join(SITE, 'assets', 'js', 'defense-cluster-network.js')
VENDOR = os.path.join(SITE, 'assets', 'vendor', 'leaflet')

PAGE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>경기도 방산기업 × 연구장비 네트워크</title>
<link rel="stylesheet" href="vendor/leaflet/leaflet.css">
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#f6f7f8;color:#1c1917;
       font-family:"Noto Sans KR","Malgun Gothic",system-ui,sans-serif;line-height:1.6}
  .wrap{max-width:1400px;margin:0 auto;padding:1.6rem 1.2rem 3rem}
  h1{font-size:1.5rem;margin:0 0 .3rem}
  .lead{margin:0 0 1rem;color:#57534e;max-width:74ch}
  .src{color:#78716c;font-size:.9rem}
  .fb-controls{display:flex;flex-wrap:wrap;gap:1rem;margin:1rem 0}
  .fb-controls fieldset{border:1px solid #e7e5e4;border-radius:10px;margin:0;padding:.5rem .8rem .7rem;background:#fff}
  .fb-controls legend{font-size:.8rem;color:#78716c;padding:0 .3rem}
  .fb-check{display:inline-flex;align-items:center;gap:.35rem;margin:.15rem .6rem .15rem 0;font-size:.9rem;cursor:pointer}
  .fb-check .sw{width:11px;height:11px;display:inline-block}
  .chip{border:1px solid #d6d3d1;background:#fff;border-radius:999px;padding:.25rem .8rem;cursor:pointer;font:inherit;font-size:.88rem}
  .chip:hover{background:#f5f5f4}
  .dc-net-grid{display:grid;gap:1rem;grid-template-columns:minmax(0,2.1fr) minmax(0,1fr)}
  @media (max-width:900px){.dc-net-grid{grid-template-columns:minmax(0,1fr)}}
  .fb-mapbox{position:relative;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;background:#0b1220}
  .fb-map{height:620px;background:#0b1220}
  .fb-legend{position:absolute;right:10px;bottom:10px;z-index:500;background:rgba(12,18,32,.86);
             color:#e7e5e4;border-radius:10px;padding:.6rem .75rem;font-size:.82rem;line-height:1.9}
  .fb-legend i{width:11px;height:11px;display:inline-block;margin-right:.45rem;border-radius:2px;vertical-align:-1px}
  .fb-busy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(12,18,32,.9);color:#e7e5e4;z-index:600}
  .fb-busy[hidden]{display:none}
  .fb-card{border:1px solid #e7e5e4;border-radius:12px;background:#fff;padding:1rem}
  .dc-net-side{max-height:620px;overflow:auto}
  .dc-net-side h4{margin:0 0 .2rem;font-size:1rem;display:flex;align-items:center;gap:.45rem}
  .dc-net-side .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:0 0 auto}
  .fb-sub{color:#78716c;font-size:.88rem;margin:.15rem 0}
  .dc-net-list{list-style:none;margin:.7rem 0 0;padding:0}
  .dc-net-list li{padding:.5rem 0;border-top:1px solid #eeeceb;font-size:.92rem}
  .dc-net-list li.hd{border-top:0;font-weight:700;color:#57534e}
  .dc-net-list .km{float:right;color:#a8a29e;font-variant-numeric:tabular-nums}
  .tag-out{font-size:.72rem;font-weight:400;color:#92400e;background:#fef3c7;
           border:1px solid #fde68a;border-radius:999px;padding:.02rem .4rem}
  .note{margin-top:1.4rem;padding:.9rem 1rem;background:#fffbeb;border:1px solid #fde68a;
        border-radius:10px;font-size:.9rem;color:#713f12}
  .files{margin-top:1rem;font-size:.9rem;color:#57534e}
  .files code{background:#f5f5f4;padding:.1rem .35rem;border-radius:4px}
</style>
</head>
<body>
<div class="wrap">
  <h1>경기도 방산기업 &times; 연구장비 네트워크</h1>
  <p class="lead" id="dc-net-note"></p>
  <p class="src" id="dc-net-src">—</p>

  <div class="fb-controls" id="dc-net-layers"></div>

  <div class="dc-net-grid">
    <div class="fb-mapbox">
      <div class="fb-map" id="dc-map4"></div>
      <div class="fb-legend" id="dc-legend4"></div>
      <div class="fb-busy" id="dc-busy4">자료를 불러오는 중입니다…</div>
    </div>
    <div class="fb-card dc-net-side" id="dc-net-info"></div>
  </div>

  <p class="note">
    ✎ 이 연결은 <b>실제 거래·납품 실적이 아닙니다.</b> 기업의 분야가 필요로 할 시험·계측 유형을
    가진 기관을 <b>가까운 순으로 최대 __K__곳</b>까지 이은, 분야 적합성과 거리에 따른 추정입니다.
    기업 위치는 확인된 경기도 사업장 주소이며, 본사가 도외인 기업은 경기도 사업장 쪽에 찍혀 있습니다.
  </p>
  <p class="files">
    같은 폴더의 <code>data/</code> 에 원자료가 있습니다 —
    <code>network.json</code>(노드·엣지), <code>기업-장비_연결.csv</code>,
    <code>방산기업.csv</code>, <code>연구장비기관.csv</code>
  </p>
</div>

<script src="vendor/leaflet/leaflet.js"></script>
<script>window.DC_NETWORK_DATA = __DATA__;</script>
<script src="defense-cluster-network.js"></script>
</body>
</html>
"""


def main():
    if not os.path.exists(NET_JSON):
        raise SystemExit('먼저 build_defense_network.py 를 실행하세요: ' + NET_JSON)

    os.makedirs(os.path.join(OUT, 'data'), exist_ok=True)
    doc = json.load(open(NET_JSON, encoding='utf-8'))
    m = doc['meta']

    # ── 1) 지도 라이브러리 (오프라인에서도 열리도록 복사) ──────────
    # Google Drive 폴더에서는 rmtree 가 막히는 경우가 있어 덮어쓰기로 복사한다
    dst = os.path.join(OUT, 'vendor', 'leaflet')
    shutil.copytree(VENDOR, dst, dirs_exist_ok=True)
    shutil.copy(NET_JS, os.path.join(OUT, 'defense-cluster-network.js'))

    # ── 2) 자료를 박아 넣은 단독 페이지 ────────────────────────────
    html = (PAGE
            .replace('__DATA__', json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
            .replace('__K__', str(m['k'])))
    p = os.path.join(OUT, 'index.html')
    open(p, 'w', encoding='utf-8').write(html)
    print(f'  index.html  {os.path.getsize(p)/1024:.0f} KB', flush=True)

    # ── 3) 원자료 ─────────────────────────────────────────────────
    shutil.copy(NET_JSON, os.path.join(OUT, 'data', 'network.json'))

    co = pd.DataFrame(doc['companies'])[
        ['name', 'cat', 'rawCat', 'si', 'addr', 'lat', 'lon', 'deg']]
    co.columns = ['기업명', '분야(7종)', '분야(원본)', '본사 소재지', '경기도 주소', '위도', '경도', '연결수']
    st = pd.DataFrame(doc['sites'])
    st['보유유형'] = st['by'].map(lambda d: ' / '.join(f'{k} {v}대' for k, v in d.items()))
    st = st[['name', 'si', 'addr', 'n', '보유유형', 'lat', 'lon', 'deg']]
    st.columns = ['기관명', '시군', '주소', '방산관련 장비수', '보유유형', '위도', '경도', '연결수']

    coi = {c['id']: c for c in doc['companies']}
    sti = {s['id']: s for s in doc['sites']}
    lab = doc['catLabel']
    ed = pd.DataFrame([{
        '기업명': coi[e['c']]['name'], '기업분야': coi[e['c']]['rawCat'],
        '기업 소재': coi[e['c']]['si'],
        '연구장비 기관': sti[e['s']]['name'], '기관 시군': sti[e['s']]['si'],
        '거리(km)': e['km'],
        '매칭 시험유형': ' / '.join(lab.get(w, w) for w in e['why']),
        '해당 장비수': e['n'],
    } for e in doc['edges']]).sort_values(['기업명', '거리(km)'])

    for df, name in ((co, f'방산기업_{len(co)}.csv'),
                     (st, f'연구장비기관_{len(st)}.csv'),
                     (ed, f'기업-장비_연결_{len(ed)}.csv')):
        df.to_csv(os.path.join(OUT, 'data', name), index=False, encoding='utf-8-sig')
        print(f'  data/{name}  {len(df)}행', flush=True)

    # ── 4) 설명 ───────────────────────────────────────────────────
    top = sorted(doc['sites'], key=lambda s: -s['deg'])[:6]
    readme = f"""# 경기도 방산기업 × 연구장비 네트워크

`index.html` 을 브라우저로 열면 됩니다. 자료가 파일 안에 들어 있어
웹서버 없이 더블클릭으로도 열립니다(지도 배경 타일만 인터넷이 필요).

## 무엇을 그린 것인가

경기도에 사업장이 확인된 **방산기업 {m['nCo']}개사**와, 방산 관련 연구장비를 가진
**연구기관 {m['nSite']}곳**을 잇는 **연결 {m['nEdge']}개**입니다.

연결 기준은 두 가지입니다.

1. **분야 적합성** — 기업의 분야가 필요로 할 시험·계측 유형(A~G)을 가진 기관만 후보
2. **근접성** — 그 후보 중 가까운 순으로 최대 {m['k']}곳 (최대 {m['maxKm']}km)

연결 거리의 중앙값은 **{m['medianKm']}km** 입니다.

> **주의** 이 연결은 실제 거래·납품 실적이 아니라 위 두 기준으로 **추정**한 것입니다.
> "이 기업이 쓸 만한 장비가 어디 있는가"를 보는 용도입니다.

## 연결이 많은 기관

| 기관 | 연결 기업수 |
|---|---|
""" + "\n".join(f"| {s['name']} | {s['deg']} |" for s in top) + f"""

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 네트워크 지도 (자료 내장) |
| `data/network.json` | 노드·엣지 원자료 |
| `data/방산기업_{len(co)}.csv` | 기업 명단 (분야·주소·좌표·연결수) |
| `data/연구장비기관_{len(st)}.csv` | 기관 명단 (장비수·보유유형·좌표·연결수) |
| `data/기업-장비_연결_{len(ed)}.csv` | 연결 목록 (거리·매칭 시험유형) |
| `vendor/leaflet/` | 지도 라이브러리 |

## 다시 만들려면

```bash
python tools/defense/build_defense_network.py
python tools/defense/build_defense_package.py
```

원본 자료는 `D:/Google_drive_20260726/1.EDU/2_geocoding/1_방산클러스터/result_data` 입니다.

## 시험유형 기호

""" + "\n".join(f"- **{k}** {v}" for k, v in lab.items()) + "\n"

    open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8').write(readme)
    print('  README.md', flush=True)
    print('\n->', OUT, flush=True)


if __name__ == '__main__':
    main()
