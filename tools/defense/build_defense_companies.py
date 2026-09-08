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

# 전국 명단 — 수도권 표에 없는 **경기도 밖** 기업만 골라 보탭니다.
#   「방산기업336개는 전국이야. 여기서는 경기도외 기타자료를 추출해서
#     지금 만드는 표를 보강해줘. 다른 지역에 겹치지 않는 기업들만 추가해서 넣어주면되」
NATION = os.path.join(OUTDIR, '방산기업_336.xlsx')

# 절대 내보내지 않는 칸 — 개인정보
DROP = {'대표 이메일', '대표 번호', '담당자', '담당자 메일', '담당자 전화번호',
        '분담', '방문', 'Unnamed: 0'}

# 시트 이름 → 화면에 쓸 지역 (본사 소재지가 비었을 때만 씁니다)
REGION = {'경기도_134': '경기', '인천_11': '인천', '서울_81': '서울', '기타_22': '기타'}


def region_of(where, sheet):
    """지역은 **본사 소재지 기준**입니다.

    원본 엑셀은 시트로 나뉘어 있지만 시트와 실제 소재지가 어긋난 곳이 많습니다 —
    「기타」 시트에 경기도 기업 다섯 곳(군포·성남·안양·용인·부천)이 들어 있었고,
    「경기도」 시트에는 서울 7곳·경남 2곳·경북 1곳·대전 1곳·인천 1곳이 섞여 있었습니다.
    그래서 시트가 아니라 주소를 보고 가릅니다.

    「충청남도 천안시(본사) 서울시 광진구(사무소)」 처럼 둘이 적힌 곳은
    **(본사)** 라고 적힌 쪽을 봅니다.
    """
    w = clean(where)
    if not w:
        return REGION.get(sheet, '기타')
    i = w.find('(본사)')
    head = (w[:i + 4] if i >= 0 else w).split()[0]
    head = head.split('(')[0]
    for key in ('경기', '서울', '인천'):
        if head.startswith(key):
            return key
    return '기타'

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


def samename(v):
    """이름을 맞대 볼 열쇠 — 띄어쓰기·㈜·꼬리 괄호를 떼고 봅니다.
       「덕산넵코어스㈜ (용인)」 과 「덕산넵코어스」 를 같은 곳으로 보아야
       같은 기업이 두 줄로 들어오지 않습니다."""
    t = clean(v).replace('㈜', '').replace('(주)', '').replace('주식회사', '')
    while t.endswith(')') and '(' in t:                 # 꼬리에 붙은 (용인) 같은 것
        t = t[:t.rfind('(')].strip()
    return t.replace(' ', '').lower()


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


def read_sheet(d, dropped):
    """엑셀 한 장을 우리 꼴의 줄 목록으로"""
    out = []
    for c in d.columns:
        if c in DROP or str(c).startswith('Unnamed'):
            dropped.add(str(c))
    for _, r in d.iterrows():
        row = {}
        for src_col, key in RENAME.items():
            if src_col in d.columns and not row.get(key):
                row[key] = clean(r.get(src_col))
        for k, _lab in COLS:
            row.setdefault(k, '')
        if row.get('name'):
            out.append(row)
    return out


def 채움(r):
    return sum(1 for k, _ in COLS if str(r.get(k) or '').strip())


def 합치기(bag, order, row, 덮어쓰기):
    """같은 기업이면 한 줄로 — 빈 칸을 채우고, 주소는 둘 다 남깁니다.

    @param 덮어쓰기 True 면 새 줄의 값이 이깁니다 (나중 보강본이 더 정확합니다)
    """
    k = samename(row['name'])
    if not k:
        return
    if k not in bag:
        bag[k] = row
        order.append(k)
        return
    a = bag[k]
    for f, _ in COLS:
        if f in ('no', 'region', 'where'):
            continue
        nv = str(row.get(f) or '').strip()
        if nv and (덮어쓰기 or not str(a.get(f) or '').strip()):
            a[f] = row[f]
    # 이름은 더 갖춰진 쪽으로 (「빅텍」 보다 「빅텍㈜」)
    if len(clean(row['name'])) > len(clean(a['name'])):
        a['name'] = row['name']
    # 주소는 둘 다 남기되 같은 것을 두 번 적지 않습니다.
    # 「(본사」 라고 적힌 주소를 맨 앞에 둡니다 — 지역은 맨 앞을 따릅니다.
    part = []
    for w in clean(a.get('where')).split(' / ') + clean(row.get('where')).split(' / '):
        w = w.strip()
        if w and w not in part:
            part.append(w)
    part.sort(key=lambda w: 0 if '본사' in w else 1)
    a['where'] = ' / '.join(part)


def main():
    """기초 명단(전국 336) 에서 시작해, 나중에 보강한 수도권 파일로 덧칠합니다.

      「방산기업336개는 전국이야 … 기본 335개인 기초자료에서 시작해서
        이 나중 파일에 들어간 경기도 자료를 구체적으로 더 보강해줘」

    수도권 파일에만 있는 칸(방산기술개발·방산관련보유기술·홈페이지·직원수·
    설립일·수상이력)이 있어, 겹치는 기업은 그쪽 값이 이깁니다.
    """
    sudo = next((q for q in XLSX_CANDIDATES if os.path.exists(q)), None)
    if not sudo:
        raise SystemExit('수도권 엑셀을 찾지 못했습니다:\n  ' + '\n  '.join(XLSX_CANDIDATES))

    fill = {}
    if os.path.exists(FILL):
        fill = json.load(open(FILL, encoding='utf-8'))

    bag, order, dropped = {}, [], set()

    # ── ① 기초: 전국 명단 ────────────────────────────────────────
    n_base = 0
    if os.path.exists(NATION):
        print('기초:', os.path.basename(NATION), flush=True)
        for row in read_sheet(pd.read_excel(NATION), dropped):
            합치기(bag, order, row, False)
            n_base += 1
        print('  %d줄 → %d개사' % (n_base, len(bag)), flush=True)
    else:
        print('(기초 명단이 없습니다: %s)' % NATION, flush=True)

    # ── ② 보강: 나중에 손질한 수도권 파일 ────────────────────────
    print('보강:', os.path.basename(sudo), flush=True)
    was = len(bag)
    n_sudo = 0
    x = pd.ExcelFile(sudo)
    for sheet in x.sheet_names:
        for row in read_sheet(x.parse(sheet), dropped):
            합치기(bag, order, row, True)
            n_sudo += 1
    print('  %d줄 → 새로 %d개사, 덧칠 %d개사'
          % (n_sudo, len(bag) - was, n_sudo - (len(bag) - was)), flush=True)

    rows = [bag[k] for k in order]

    # ── ③ 지역은 본사 소재지 기준 ────────────────────────────────
    for r in rows:
        r['region'] = region_of(r.get('where'), '')

    # ── ④ 조사로 찾아 둔 것으로 남은 빈 칸 채우기 ────────────────
    nfill = {k: 0 for k in FILLABLE}
    byname = {}
    for k, v in fill.items():
        byname[samename(k)] = v
    for r in rows:
        got = byname.get(samename(r['name']))
        if not got:
            continue
        mark = {}
        for k in FILLABLE:
            if not str(r.get(k) or '').strip() and got.get(k):
                r[k] = clean(got[k])
                mark[k] = got.get('src') or '조사'
                nfill[k] += 1
        if mark:
            r['_fill'] = mark

    # 지역 안에서 가나다순
    seq = ['경기', '서울', '인천', '기타']
    rows.sort(key=lambda r: (seq.index(r['region']) if r['region'] in seq else 9, r['name']))
    for i, r in enumerate(rows, 1):
        r['no'] = i

    empty = {k: sum(1 for r in rows if not r.get(k)) for k, _ in COLS}
    print('기업 %d개사' % len(rows), flush=True)
    print('빼놓은 칸(개인정보 등): ' + ', '.join(sorted(dropped)), flush=True)
    for k in FILLABLE:
        print('  %s — 조사로 채운 것 %d개사 · 아직 빈 곳 %d개사'
              % (k, nfill[k], empty[k]), flush=True)

    doc = {
        'meta': {
            'label': '방위산업 기업 리스트',
            'note': '전국 방위산업 관련 기업 명단입니다 — 전국 기초 명단에 '
                    '수도권(경기·서울·인천) 보강 자료를 덧칠했습니다. '
                    '지역은 본사 소재지 기준이며, 본사와 지사가 함께 적힌 곳은 '
                    '주소를 모두 남겼습니다. 대표·담당자 연락처는 담지 않았습니다. '
                    '「주요 분야」·「방산기술개발」·「방산관련보유기술」 가운데 '
                    '표에 비어 있던 칸을 공개된 자료로 채운 것은 밑줄로 표시했습니다 — '
                    '확인 뒤 쓰시기 바랍니다.',
            'src': os.path.basename(NATION) + ' + ' + os.path.basename(sudo),
            'n': len(rows),
            'byRegion': {reg: sum(1 for r in rows if r['region'] == reg)
                         for reg in sorted({r['region'] for r in rows})},
        },
        'cols': [{'key': k, 'label': lab} for k, lab in COLS],
        'rows': rows,
    }
    os.makedirs(OUTDIR, exist_ok=True)
    q = os.path.join(OUTDIR, 'companies.json')
    json.dump(doc, open(q, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(' ', q, '%.0f KB' % (os.path.getsize(q) / 1024), flush=True)


if __name__ == '__main__':
    main()
