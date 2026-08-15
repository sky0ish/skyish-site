# -*- coding: utf-8 -*-
"""행정안전부_침수흔적도(safetydata.go.kr, DSSP-IF-00117) 전건 수집 → 로컬 캐시.

사용법 (PowerShell)
    $env:SAFETYDATA_KEY = "발급받은_서비스키"
    python tools/flood/fetch_mois_flood.py

  · 인증키는 소스에 넣지 말고 환경변수로 넘깁니다.
  · 1회 1000건씩, 전국 약 38,000건이면 39회 호출 (일일 한도 100회).
  · 결과는 tools/flood/cache/mois_flood_raw.json 에 저장되며 저장소에는 올리지 않습니다.
"""
import io, json, os, ssl, sys, time, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ssl._create_default_https_context = ssl._create_unverified_context

KEY = os.environ.get('SAFETYDATA_KEY')
if not KEY:
    raise SystemExit('환경변수 SAFETYDATA_KEY 에 safetydata.go.kr 서비스키를 넣어 주세요.')

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
os.makedirs(CACHE, exist_ok=True)
OUT = os.path.join(CACHE, 'mois_flood_raw.json')
ROWS = 1000

rows, page, total = [], 1, None
while True:
    url = (f'https://www.safetydata.go.kr/V2/api/DSSP-IF-00117?serviceKey={KEY}'
           f'&pageNo={page}&numOfRows={ROWS}&returnType=json')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                j = json.loads(r.read())
            break
        except Exception as e:
            print(f'page {page} attempt {attempt + 1} failed: {e!r}', flush=True)
            time.sleep(5)
    else:
        print('GIVE UP at page', page, flush=True)
        break

    if j.get('header', {}).get('resultCode') != '00':
        print('API error', j.get('header'), flush=True)
        break
    body = j.get('body') or []
    total = j.get('totalCount', total)
    rows.extend(body)
    print(f'page {page}: +{len(body)} = {len(rows)} / {total}', flush=True)
    if len(body) < ROWS or (total and len(rows) >= total):
        break
    page += 1
    time.sleep(0.3)

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False)
print('saved', OUT, len(rows), 'features', flush=True)

from collections import Counter
print(Counter(r['STDG_CTPV_CD'] for r in rows).most_common(), flush=True)
