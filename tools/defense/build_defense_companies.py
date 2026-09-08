# -*- coding: utf-8 -*-
"""수도권 방산기업 리스트 — defense-companies.html 이 읽는 자료를 만듭니다.

원본: 「260721_수도권 방산리스트_기업추가_CYS_분야보강.xlsx」
      시트 넷(경기도·인천·서울·기타)을 하나로 합칩니다.

  ※ 개인정보는 담지 않습니다.
    대표 이메일·대표 번호·담당자·담당자 메일·담당자 전화번호는 **빼고** 내보냅니다.
    홈페이지에 올라가는 자료이므로, 사람 이름과 연락처는 들어가면 안 됩니다.

  ※ 비어 있는 칸을 채운 것(주요 분야·방산기술개발·방산관련보유기술)은
    `_src` 에 「보강」 으로 표시합니다. 화면에서 눈에 띄게 그려 사람이 확인할 수 있게 합니다.

출력: assets/data/defense/companies.json  (Supabase 의 비공개 보관함 analysis 에 올립니다)
"""
import io, json, math, os, sys, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
OUTDIR = os.path.join(SITE, 'assets', 'data', 'defense')

XLSX_CANDIDATES = [
    r'G:\내 드라이브\00. 경기도 피지컬 AI 방산생태계 조성전략_Shared\6.리스트'
    r'\260721_수도권 방산리스트_기업추가_CYS_분야보강.xlsx',
]
# 사람이 손으로 채우거나 조사로 채운 보강분 (build_defense_fill.py 가 만듭니다)
FILL = os.path.join(HERE, 'companies_fill.json')

# 절대 내보내지 않는 칸 — 개인정보
DROP = {'대표 이메일', '대표 번호', '담당자', '담당자 메일', '담당자 전화번호',
        '분담', '방문', 'Unnamed: 0'}

# 시트 이름 → 화면에 쓸 지역
REGION = {'경기도_134': '경기', '인천_11': '인천', '서울_81': '서울', '기타_22': '기타'}

# 원본 칸 이름 → 내보낼 이름 (시트마다 이름이 조금씩 달라 하나로 맞춥니다)
RENAME = {
    '주요 분야': 'field',
    '방산기술개발(국방부사업)': 'rnd',
    '방산관련보유기술': 'tech',
    '방산여부': 'isDef',
    '본사 소재지 (시/군)': 'where',
    '대분류(우주/드론/인공지능/로봇/반도체/센서/기타)': 'cat',
    '소분류': 'sub',
    '산업통상부': 'motie',
    '방산혁신기업/누리호': 'innov',
    '방산진흥회/방산중소벤처협회/경기국방벤처센터': 'assoc',
    '방산진흥회/벤처': 'assoc',
    '성균관AX협약': 'skku',
    '주식상장': 'listed',
    '주식상장/기타이력': 'listed',
    '협력 파트너': 'partner',
    '수상이력': 'award',
    '홈페이지': 'site',
    '직원수': 'staff',
    '설립일': 'founded',
    '기업명': 'name',
    '지역번호': 'code',
    '순위': 'rank',
}

# 화면에 보일 차례와 이름
COLS = [
    ('no',      '#'),
    ('region',  '지역'),
    ('name',    '기업명'),
    ('cat',     '대분류'),
    ('sub',     '소분류'),
    ('field',   '주요 분야'),
    ('rnd',     '방산기술개발(국방부사업)'),
    ('tech',    '방산관련보유기술'),
    ('isDef',   '방산여부'),
    ('where',   '본사 소재지'),
    ('motie',   '산업통상부'),
    ('innov',   '방산혁신기업·누리호'),
    ('assoc',   '방산진흥회·벤처'),
    ('skku',    '성균관AX'),
    ('listed',  '주식상장·기타이력'),
    ('partner', '협력 파트너'),
    ('award',   '수상이력'),
    ('staff',   '직원수'),
    ('founded', '설립일'),
    ('site',    '홈페이지'),
]

# 조사로 채울 수 있는 칸 — 비어 있으면 companies_fill.json 에서 가져옵니다
FILLABLE = ['field', 'rnd', 'tech']


def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ''
    s = str(v).replace('\r', ' ').replace('\n', ' ').strip()
    if s.lower() in ('nan', 'nat', 'none'):
        return ''
    # 엑셀이 날짜로 읽어 버린 설립일 등을 사람이 읽는 꼴로
    if s.endswith(' 00:00:00'):
        s = s[:-9]
    return ' '.join(s.split())


def main():
    src = next((p for p in XLSX_CANDIDATES if os.path.exists(p)), None)
    if not src:
        raise SystemExit('원본 엑셀을 찾지 못했습니다:\n  ' + '\n  '.join(XLSX_CANDIDATES))
    print('원본:', src, flush=True)

    fill = {}
    if os.path.exists(FILL):
        fill = json.load(open(FILL, encoding='utf-8'))
        print('보강 자료: %d개사' % len(fill), flush=True)

    x = pd.ExcelFile(src)
    rows, dropped = [], set()
    for sheet in x.sheet_names:
        region = REGION.get(sheet, sheet)
        d = x.parse(sheet)
        d = d[d['기업명'].notna()]
        for c in d.columns:
            if c in DROP or str(c).startswith('Unnamed'):
                dropped.add(str(c))
        for _, r in d.iterrows():
            row = {'region': region}
            for src_col, key in RENAME.items():
                if src_col in d.columns and not row.get(key):
                    row[key] = clean(r.get(src_col))
            for k, _lab in COLS:
                row.setdefault(k, '')
            rows.append(row)

    # 같은 기업이 여러 시트에 겹쳐 들어온 경우 한 번만
    seen, uniq = set(), []
    for r in rows:
        k = (r['name'], r['region'])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    rows = uniq

    # ── 빈 칸 채우기 ────────────────────────────────────────────
    nfill = {k: 0 for k in FILLABLE}
    for r in rows:
        got = fill.get(r['name'])
        if not got:
            continue
        src_mark = {}
        for k in FILLABLE:
            if not r.get(k) and got.get(k):
                r[k] = clean(got[k])
                src_mark[k] = got.get('src') or '조사'
                nfill[k] += 1
        if src_mark:
            r['_fill'] = src_mark

    for i, r in enumerate(rows, 1):
        r['no'] = i

    empty = {k: sum(1 for r in rows if not r.get(k)) for k, _ in COLS}
    print('기업 %d개사' % len(rows), flush=True)
    print('빼놓은 칸(개인정보 등): ' + ', '.join(sorted(dropped)), flush=True)
    for k in FILLABLE:
        print('  %s — 채운 것 %d개사 · 아직 빈 곳 %d개사'
              % (k, nfill[k], empty[k]), flush=True)

    doc = {
        'meta': {
            'label': '수도권 방산기업 리스트',
            'note': '경기·인천·서울과 그 밖 지역에 있는 방위산업 관련 기업 명단입니다. '
                    '대표·담당자 연락처는 담지 않았습니다. '
                    '「주요 분야」·「방산기술개발」·「방산관련보유기술」 가운데 '
                    '표에 비어 있던 칸을 공개된 자료로 채운 것은 밑줄로 표시했습니다 — '
                    '확인 뒤 쓰시기 바랍니다.',
            'src': os.path.basename(src),
            'n': len(rows),
            'byRegion': {reg: sum(1 for r in rows if r['region'] == reg)
                         for reg in sorted({r['region'] for r in rows})},
        },
        'cols': [{'key': k, 'label': lab} for k, lab in COLS],
        'rows': rows,
    }
    os.makedirs(OUTDIR, exist_ok=True)
    p = os.path.join(OUTDIR, 'companies.json')
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(' ', p, '%.0f KB' % (os.path.getsize(p) / 1024), flush=True)


if __name__ == '__main__':
    main()
