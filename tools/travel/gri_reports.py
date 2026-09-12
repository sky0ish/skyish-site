# -*- coding: utf-8 -*-
"""
경기연구원 해외출장보고서 → 10.TRAVEL/ + gri.json

  「경기연구원의 출장보고서 게시판에서 가져와서 [Travel]안에 GRI출장보고서 로 모두 긁어와줘.
    pdf를 그대로 가져오되, 제목은 [2020.0218.홍길동]영국,이탈리아_출장명 이런식으로.
    출장자는 맨앞에 한명만. 해당 게시판의 이름에 맞는 폴더를 만들어서 [11.게시판명_Data] 요렇게 넣어줘.」

들어오는 것
  · Downloads/gri_meta.json     그룹웨어 목록·본문·첨부 (브라우저에서 긁어 내려받은 것)
  · Downloads/gri_<번호>_<차례>.pdf  첨부 원본 (이름은 임시)
나가는 것
  · 11.해외출장보고_Data/[2020.0218.홍길동]영국,이탈리아_출장명.pdf  ← 이름을 바꿔 옮깁니다
  · 11.해외출장보고_Data/_text/<같은 이름>.txt                      ← 본문 글자 (요약 재료)
  · 11.해외출장보고_Data/gri.json                                   ← 홈페이지가 읽는 목록

이름의 재료는 게시글 본문(출장명 · 출장기간 · 출장지역 · 출장자)이고, 옛 글(2013~2018)은
본문이 비어 있어 PDF 첫 쪽에서 같은 항목을 찾습니다. 그래도 없으면 제목·파일 이름에서 짐작합니다.

돌리는 법 :  python tools/travel/gri_reports.py            (이름 바꾸기 + 글자 뽑기 + gri.json)
             python tools/travel/gri_reports.py --dry      (옮기지 않고 이름만 보여 줍니다)
"""
import io, json, os, re, shutil, sys, glob, datetime
sys.stdout.reconfigure(encoding="utf-8")

HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOWN = os.path.join(os.path.expanduser("~"), "Downloads")
OUT = os.path.join(HOME, "11.해외출장보고_Data")
# 임시 이름(gri_번호_차례.pdf)의 원본이 있을 만한 곳 — 내려받기 폴더, 손으로 옮겨 두신 곳, 이 폴더 자신
SRC_DIRS = [DOWN, os.path.join(os.path.dirname(HOME), "HP_GRILU", "11.해외출장보고_Data"), OUT]
TXT = os.path.join(OUT, "_text")
DRY = "--dry" in sys.argv

# ── 나라 → 권역 (travel.html 의 TRAVEL_REGIONS 와 맞춥니다) ──
COUNTRY = [
    ("미국", "usa", "usa"), ("뉴욕", "usa", "usa"), ("워싱턴", "usa", "usa"), ("보스턴", "usa", "usa"),
    ("일본", "japan", "japan"), ("도쿄", "japan", "japan"), ("동경", "japan", "japan"), ("오사카", "japan", "japan"),
    ("교토", "japan", "japan"), ("후쿠오카", "japan", "japan"), ("요코하마", "japan", "japan"),
    ("중국", "china", "china"), ("대만", "taiwan", "china"), ("타이완", "taiwan", "china"), ("홍콩", "hongkong", "china"),
    ("상하이", "china", "china"), ("상해", "china", "china"), ("북경", "china", "china"), ("베이징", "china", "china"),
    ("영국", "uk", "europe"), ("런던", "uk", "europe"), ("스코틀랜드", "uk", "europe"),
    ("프랑스", "france", "europe"), ("파리", "france", "europe"), ("독일", "germany", "europe"), ("베를린", "germany", "europe"),
    ("네덜란드", "netherlands", "europe"), ("암스테르담", "netherlands", "europe"), ("이탈리아", "italy", "europe"),
    ("스페인", "spain", "europe"), ("아일랜드", "ireland", "europe"), ("벨기에", "belgium", "europe"),
    ("스위스", "switzerland", "europe"), ("오스트리아", "austria", "europe"), ("포르투갈", "portugal", "europe"),
    ("덴마크", "denmark", "europe"), ("스웨덴", "sweden", "europe"), ("노르웨이", "norway", "europe"),
    ("핀란드", "finland", "europe"), ("체코", "czech", "europe"), ("폴란드", "poland", "europe"),
    ("그리스", "greece", "europe"), ("헝가리", "hungary", "europe"), ("에스토니아", "estonia", "europe"),
    ("라트비아", "latvia", "europe"), ("리투아니아", "lithuania", "europe"), ("슬로베니아", "slovenia", "europe"),
    ("크로아티아", "croatia", "europe"), ("루마니아", "romania", "europe"), ("불가리아", "bulgaria", "europe"),
    ("터키", "turkey", "etc"), ("튀르키예", "turkey", "etc"), ("러시아", "russia", "etc"),
    ("캐나다", "canada", "etc"), ("호주", "australia", "etc"), ("오스트레일리아", "australia", "etc"), ("뉴질랜드", "newzealand", "etc"),
    ("싱가포르", "singapore", "etc"), ("말레이시아", "malaysia", "etc"), ("인도네시아", "indonesia", "etc"),
    ("베트남", "vietnam", "etc"), ("태국", "thailand", "etc"), ("필리핀", "philippines", "etc"), ("캄보디아", "cambodia", "etc"),
    ("라오스", "laos", "etc"), ("미얀마", "myanmar", "etc"), ("인도", "india", "etc"), ("네팔", "nepal", "etc"),
    ("몽골", "mongolia", "etc"), ("우즈베키스탄", "uzbekistan", "etc"), ("카자흐스탄", "kazakhstan", "etc"),
    ("아제르바이잔", "azerbaijan", "etc"), ("아랍에미리트", "uae", "etc"), ("두바이", "uae", "etc"), ("이스라엘", "israel", "etc"),
    ("브라질", "brazil", "etc"), ("멕시코", "mexico", "etc"), ("칠레", "chile", "etc"), ("아르헨티나", "argentina", "etc"),
    ("남아프리카", "southafrica", "etc"), ("케냐", "kenya", "etc"), ("이집트", "egypt", "etc"), ("모로코", "morocco", "etc"),
    ("부탄", "bhutan", "etc"), ("페루", "peru", "etc"), ("쿠바", "cuba", "etc"), ("코트디부아르", "ivorycoast", "etc"),
    ("코트드부아르", "ivorycoast", "etc"), ("오키나와", "japan", "japan"), ("마카오", "macau", "china"), ("이란", "iran", "etc"),
    ("사우디", "saudi", "etc"), ("카타르", "qatar", "etc"), ("콜롬비아", "colombia", "etc"), ("에콰도르", "ecuador", "etc"),
    ("볼리비아", "bolivia", "etc"), ("파라과이", "paraguay", "etc"), ("우루과이", "uruguay", "etc"), ("파나마", "panama", "etc"),
    ("코스타리카", "costarica", "etc"), ("탄자니아", "tanzania", "etc"), ("에티오피아", "ethiopia", "etc"), ("가나", "ghana", "etc"),
    ("르완다", "rwanda", "etc"), ("우간다", "uganda", "etc"), ("세네갈", "senegal", "etc"), ("튀니지", "tunisia", "etc"),
    ("스리랑카", "srilanka", "etc"), ("방글라데시", "bangladesh", "etc"), ("파키스탄", "pakistan", "etc"), ("키르기스스탄", "kyrgyzstan", "etc"),
    ("조지아", "georgia", "etc"), ("우크라이나", "ukraine", "etc"), ("세르비아", "serbia", "europe"), ("슬로바키아", "slovakia", "europe"),
    ("룩셈부르크", "luxembourg", "europe"), ("아이슬란드", "iceland", "europe"), ("몰타", "malta", "europe"), ("북한", "northkorea", "etc"),
    ("라오스", "laos", "etc"), ("대한민국", "korea", "etc"),
]

def find_meta():
    """gri_meta.json — 내려받기 폴더에 없으면 옮겨 두신 곳에서 찾아 이 폴더에 베껴 둡니다"""
    for sd in [OUT] + SRC_DIRS:
        for nm in ("_gri_meta.json", "gri_meta.json"):
            p = os.path.join(sd, nm)
            if os.path.exists(p):
                keep = os.path.join(OUT, "_gri_meta.json")
                if not DRY and os.path.abspath(p) != os.path.abspath(keep):
                    os.makedirs(OUT, exist_ok=True)
                    shutil.copy2(p, keep)
                return p
    raise FileNotFoundError("gri_meta.json 을 찾지 못했습니다 — " + ", ".join(SRC_DIRS))

def load_meta():
    d = json.load(io.open(find_meta(), encoding="utf-8"))
    while isinstance(d, str):
        d = json.loads(d)            # 그룹웨어의 prototype.js 가 JSON 을 두 겹으로 쌉니다
    return sorted(d, key=lambda o: -int(o["num"]))

def clean(s):
    s = str(s or "").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()

# ── PDF 글자 뽑기 ──
def pdf_text(path, max_pages=40, max_chars=60000):
    try:
        import pdfplumber
        out = []
        with pdfplumber.open(path) as pdf:
            for i, pg in enumerate(pdf.pages[:max_pages]):
                t = pg.extract_text() or ""
                out.append(t)
                if sum(len(x) for x in out) > max_chars:
                    break
        return "\n".join(out)[:max_chars]
    except Exception as e:
        try:
            from pypdf import PdfReader
            r = PdfReader(path)
            out = []
            for pg in r.pages[:max_pages]:
                out.append(pg.extract_text() or "")
                if sum(len(x) for x in out) > max_chars:
                    break
            return "\n".join(out)[:max_chars]
        except Exception as e2:
            return ""

# ── 본문에서 항목 뽑기 ──
def pick(text, label_re, stop_re=r"(?=\s*[-–•□■○▪◦]\s*(출|과|첨|참|주|비|기|일)|\n|$)"):
    """「출 장 명 : …」 처럼 「라벨 : 값」 꼴을 찾습니다. 값은 다음 항목 표시 앞까지."""
    m = re.search("(?:" + label_re + r")\s*[:：]\s*(.+?)" + stop_re, text, re.S)
    return clean(m.group(1)) if m else ""

L_NAME = r"출\s*장\s*명|과\s*제\s*명|출장\s*목적|출장\s*제목|출장\s*건명"
L_PERIOD = r"출장\s*기\s*간|기\s*간|일\s*시|출장\s*일정|출장\s*일자"
L_WHERE = r"출장\s*지\s*역|출\s*장\s*지|출장\s*국가|방문\s*국가|방문\s*지역|출장\s*국"
L_WHO = r"출\s*장\s*자|출장자\s*명단|출장\s*인원|출장\s*자\s*성명"

def parse_period(s, year_hint=""):
    """「2020년 02월 18일 ~ 02월 28일」 「2018. 8. 19 ~ 8. 25」 → (YYYY, MM, DD)"""
    s = clean(s)
    m = re.search(r"(20\d{2})\s*[.년\-/]\s*(\d{1,2})\s*[.월\-/]\s*(\d{1,2})", s)
    if m:
        return m.group(1), int(m.group(2)), int(m.group(3))
    # 「‘15. 6.7(일)~6.15」 「'18. 3. 1」 — 두 자리 해
    m = re.search(r"[‘’'`]\s*(\d{2})\s*[.년]\s*(\d{1,2})\s*[.월]\s*(\d{1,2})", s)
    if m:
        return "20" + m.group(1), int(m.group(2)), int(m.group(3))
    m = re.search(r"(20\d{2})\s*[.년\-/]\s*(\d{1,2})\s*월?", s)
    if m:
        return m.group(1), int(m.group(2)), 0
    m = re.search(r"(\d{1,2})\s*[.월]\s*(\d{1,2})\s*일?", s)
    if m and year_hint:
        return year_hint, int(m.group(1)), int(m.group(2))
    return "", 0, 0

def title_month(title):
    """「[2024.2월] 미국 해외출장보고」 → ("2024", 2, "미국 해외출장보고")"""
    m = re.match(r"\s*\[\s*(20\d{2})\s*\.?\s*(\d{1,2})\s*월?\s*\]\s*(.*)$", title)
    if m:
        return m.group(1), int(m.group(2)), clean(m.group(3))
    m = re.search(r"(20\d{2})", title)
    return (m.group(1) if m else ""), 0, clean(title)

def names_from(who):
    """「시군연구센터 홍길동 선임연구위원, 경제사회연구실 김철수 선임연구위원」 → ["홍길동", "김철수"]
       「홍길동·김철수·이영희 선임연구위원」 도 셋으로."""
    who = clean(who)
    who = re.sub(r"\([^)]*\)", " ", who)
    out = []
    for tok in re.split(r"[,、·ㆍ/]|\s+및\s+|\s+외\s+\d+\s*인|\s+등", who):
        for w in tok.split():
            w = w.strip("()[]『』「」.")
            if re.fullmatch(r"[가-힣]{2,4}", w) and w not in NOT_NAME and not re.search(r"(연구|위원|센터|실$|부$|단$|팀$|장$|원$|님$|대학|교수|박사|과장|주무관|기획|경기|담당|본부|국$|시$|군$|구$|도$)", w):
                if w not in out:
                    out.append(w)
    return out

NOT_NAME = set(ko for ko, key, region in COUNTRY) | {
    "게시용", "보고서", "보고", "출장", "해외", "발표", "자료", "결과", "최종", "수정", "공유", "제출", "첨부",
    "국외", "공무", "여행", "계획", "산동", "도쿄", "동경", "선전", "마카오", "난닝", "제로", "셔틀", "판교", "교통", "연구", "학술",
    "원장님", "원장", "부원장", "일행", "기타", "전체", "요약", "본문", "사본",
}
def names_from_file(fname):
    """「GRI 2018.8월 해외출장보고(홍길동 외 2인).pdf」 「…_홍길동.pdf」 「…_홍길동, 김철수, 이영희 (1).pdf」"""
    stem = re.sub(r"\.\w+$", "", fname)
    stem = re.sub(r"\s*\(\d+\)\s*$", "", stem)                       # 「 (1)」 내려받기 꼬리
    stem = re.sub(r"[-_ ]*(게시용|공유|최종|제출|수정본?)\s*$", "", stem)   # 「-게시용」 「_공유」
    stem = re.sub(r"\((최종|제출|게시용)\)", "", stem)
    m = re.search(r"\(([^)]*)\)\s*$", stem)
    cand = m.group(1) if m else ""
    if not cand:
        # 마지막 「_」 뒤 — 「…_일본도쿄_홍길동, 김철수, 이영희」
        parts = re.split(r"[_]", stem)
        for part in reversed(parts):
            ws = [w for w in re.findall(r"[가-힣]{2,4}", part) if w not in NOT_NAME]
            if ws:
                cand = part
                break
    return [w for w in re.findall(r"[가-힣]{2,4}", cand)
            if w not in NOT_NAME and not re.search(r"(외$|인$|연구|위원)", w)]

def where_from(s, title_rest=""):
    """지역 글에서 나라 이름만 — 「영국(런던), 스페인(마드리드)」 → ["영국", "스페인"]"""
    s = clean(s)
    HANGUL = re.compile(r"[가-힣]")
    def scan(t):
        hits = []
        for ko, key, region in COUNTRY:
            i = t.find(ko)
            # 「츠쿠바」 의 「쿠바」 처럼 다른 낱말 속에 든 것은 뺍니다 — 바로 앞 글자가 한글이면 낱말 중간입니다
            while i >= 0 and i > 0 and HANGUL.match(t[i - 1]):
                i = t.find(ko, i + 1)
            if i >= 0:
                hits.append((i, ko))
        hits.sort(key=lambda h: (h[0], -len(h[1])))
        out = []
        for i, ko in hits:                              # 글에 나온 차례대로
            # 「인도네시아」 안의 「인도」 처럼 긴 이름에 포개진 짧은 이름은 뺍니다
            if any(j <= i < j + len(k) and k != ko and len(k) > len(ko) for j, k in hits):
                continue
            out.append(ko)
        return out
    found = scan(s) or (scan(title_rest) if title_rest else [])
    # 도시 이름은 나라로 접습니다 (뉴욕→미국 …)
    fold = {"뉴욕": "미국", "워싱턴": "미국", "보스턴": "미국", "도쿄": "일본", "동경": "일본", "오사카": "일본", "교토": "일본",
            "후쿠오카": "일본", "요코하마": "일본", "상하이": "중국", "상해": "중국", "북경": "중국", "베이징": "중국",
            "런던": "영국", "스코틀랜드": "영국", "파리": "프랑스", "베를린": "독일", "암스테르담": "네덜란드", "두바이": "아랍에미리트",
            "타이완": "대만", "오스트레일리아": "호주", "튀르키예": "터키", "오키나와": "일본", "코트드부아르": "코트디부아르"}
    out = []
    for f in found:
        f = fold.get(f, f)
        if f not in out:
            out.append(f)
    return out

def region_of(countries):
    keys = []
    for c in countries:
        for ko, key, region in COUNTRY:
            if ko == c:
                if key not in keys:
                    keys.append(key)
                break
    regions = []
    for c in countries:
        for ko, key, region in COUNTRY:
            if ko == c:
                if region not in regions:
                    regions.append(region)
                break
    return keys, regions

def safe_name(s, limit=70):
    s = clean(s).replace("/", "·").replace("\\", "·")
    s = re.sub(r'[:*?"<>|]', "", s)
    s = re.sub(r"[「」『』“”\"']", "", s)
    s = s.strip(" .-_")
    if len(s) > limit:
        cut = s[:limit]
        # 낱말 중간에서 끊지 않습니다
        if " " in cut[40:]:
            cut = cut[:cut.rfind(" ")]
        s = cut.rstrip(" ,.·-_(") + "…"
    return s

def digest(o, texts):
    """한 게시글 → 이름의 재료 (본문 → PDF 글자 → 제목·파일 이름 차례로)"""
    body = clean(o.get("body", ""))
    ty, tm, trest = title_month(o["title"])
    srcs = [("body", body)] + [("pdf:" + a["name"], texts.get(a["name"], "")[:6000]) for a in o.get("att", [])]

    name = period = where = who = ""
    for tag, t in srcs:
        if not t:
            continue
        name = name or pick(t, L_NAME)
        period = period or pick(t, L_PERIOD)
        where = where or pick(t, L_WHERE)
        who = who or pick(t, L_WHO)
        if name and period and where and who:
            break

    y, mth, d = parse_period(period, ty)
    if not y or not (1 <= mth <= 12) or not (0 <= d <= 31):
        y, mth, d = ty, tm, 0                      # 못 읽었거나 말이 안 되면 제목의 해·달로
    travelers = names_from(who)
    if not travelers:
        for a in o.get("att", []):
            travelers = names_from_file(a["name"])
            if travelers:
                break
    countries = where_from(where, trest)
    keys, regions = region_of(countries)
    trip = name or re.sub(r"\s*해외\s*출장\s*(\(대외활동\))?\s*(결과)?\s*보고\s*$", "", trest).strip() or trest
    trip = re.sub(r"^[「『\"“]|[」』\"”]$", "", clean(trip))
    # 출장명을 못 찾아 나라 이름만 남으면(「라오스_라오스」) 「해외출장보고」 로 — 나라는 앞에 이미 있습니다
    if not name and countries and re.sub(r"[\s·,/()]+", "", trip) == re.sub(r"[\s·,/()]+", "", "".join(countries)):
        trip = "해외출장보고"
    if not name and countries and all(w in "".join(countries) or w in ("등", "·", ",", "/") for w in re.split(r"[\s·,/()]+", trip) if w):
        trip = "해외출장보고"
    return {
        "year": y, "month": mth, "day": d,
        "date": (f"{y}-{mth:02d}-{d:02d}" if y and mth and d else f"{y}-{mth:02d}" if y and mth else y),
        "trip": trip, "period": period, "where": where, "who": who,
        "travelers": travelers, "countries": countries, "countryKeys": keys, "regions": regions or ["etc"],
        "filled": {"name": bool(name), "period": bool(period), "where": bool(where), "who": bool(who)},
    }

def file_title(dg, countries_fallback):
    """[2020.0218.홍길동]영국,이탈리아_출장명"""
    stamp = dg["year"] + "." + (f"{dg['month']:02d}{dg['day']:02d}" if dg["day"] else f"{dg['month']:02d}" if dg["month"] else "")
    stamp = stamp.rstrip(".")
    who = dg["travelers"][0] if dg["travelers"] else "미상"
    where = ",".join(dg["countries"]) if dg["countries"] else (countries_fallback or "해외")
    return "[" + stamp + "." + who + "]" + safe_name(where, 40) + "_" + safe_name(dg["trip"])

def main():
    meta = load_meta()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TXT, exist_ok=True)
    rows = []
    missing = []
    claimed = {}                       # 이름 → 게시글 번호 — 같은 이름이 두 번 나오면 뒤엣것에 번호를 붙입니다
    for o in meta:
        atts = o.get("att", [])
        if not atts:
            print("  첨부 없음 — 건너뜀:", o["num"], o["title"])
            continue
        # ① 첨부 원본 찾기
        files = []
        for a in atts:
            ext = (re.search(r"\.(\w+)$", a["name"]) or [None, "bin"])[1].lower()
            tmp = ""
            for sd in SRC_DIRS:
                cand = os.path.join(sd, f"gri_{o['num']}_{a['seq']}.{ext}")
                if os.path.exists(cand):
                    tmp = cand
                    break
            if not tmp:
                tmp = os.path.join(DOWN, f"gri_{o['num']}_{a['seq']}.{ext}")
            files.append({"att": a, "ext": ext, "tmp": tmp, "ok": os.path.exists(tmp)})
            if not os.path.exists(tmp):
                missing.append(tmp)
        # ② 글자 (PDF 만) — 한 번 뽑은 것은 _text/_cache 에 두고 다시 씁니다
        texts = {}
        for f in files:
            if f["ext"] != "pdf":
                continue
            cache = os.path.join(TXT, "_cache", f"gri_{o['num']}_{f['att']['seq']}.txt")
            if os.path.exists(cache):
                texts[f["att"]["name"]] = io.open(cache, encoding="utf-8").read()
            elif f["ok"]:
                texts[f["att"]["name"]] = pdf_text(f["tmp"])
                if not DRY:
                    os.makedirs(os.path.dirname(cache), exist_ok=True)
                    io.open(cache, "w", encoding="utf-8").write(texts[f["att"]["name"]])
        dg = digest(o, texts)
        base = file_title(dg, "")
        # 같은 출장이 두 번 게시된 글(2013년 5·6월 셋 — 고쳐서 다시 올린 것이라 파일이 조금 다릅니다)
        # 이름이 겹치면 앞 글(작은 번호)에 게시글 번호를 붙여 둘 다 남깁니다
        if base in claimed:
            print(f"  이름 겹침 — {o['num']}번은 「(게시{o['num']}번)」 을 붙임: {base[:60]} (= {claimed[base]}번과)")
            base = base + f" (게시{o['num']}번)"
        claimed[base] = o["num"]
        # ③ 이름 정하기 — 보고서를 앞에, 발표자료 따위는 뒤에 원래 이름을 붙여
        main_i = 0
        for i, f in enumerate(files):
            if re.search(r"보고", f["att"]["name"]):
                main_i = i
                break
        out_files = []
        for i, f in enumerate(files):
            if i == main_i:
                fname = base + "." + f["ext"]
            else:
                stem = safe_name(re.sub(r"\.\w+$", "", f["att"]["name"]), 50)
                fname = base + " (" + stem + ")." + f["ext"]
            dest = os.path.join(OUT, fname)
            if not DRY and f["ok"]:
                if not os.path.exists(dest):
                    # 내려받기 폴더 것은 옮기고, 다른 곳(HP_GRILU 등 다른 작업 폴더)에 있는 것은 베낍니다 —
                    # 그쪽 작업을 건드리지 않기 위해서입니다
                    if os.path.dirname(f["tmp"]) in (DOWN, OUT):
                        try:
                            shutil.move(f["tmp"], dest)
                        except PermissionError:          # 다른 프로그램이 잡고 있으면 베끼기만
                            shutil.copy2(f["tmp"], dest)
                    else:
                        shutil.copy2(f["tmp"], dest)
                t = texts.get(f["att"]["name"])
                if t is not None:
                    io.open(os.path.join(TXT, re.sub(r"\.\w+$", "", fname) + ".txt"), "w", encoding="utf-8").write(t)
            out_files.append({"file": fname, "orig": f["att"]["name"], "size": (os.path.getsize(dest) if os.path.exists(dest) else (os.path.getsize(f["tmp"]) if f["ok"] else 0)),
                              "kind": f["ext"], "seq": int(f["att"]["seq"]), "textChars": len(texts.get(f["att"]["name"], "")), "main": i == main_i,
                              # 보관함 안 이름 — 한글·괄호가 든 이름은 주소에서 말썽이라 번호로 둡니다
                              "key": f"travel/gri/{o['num']}_{f['att']['seq']}.{f['ext']}"})
        rows.append({
            "num": int(o["num"]), "id": o["id"], "postTitle": o["title"], "posted": o["date"].replace(".", "-"),
            "poster": o["posterShort"], "title": base, "trip": dg["trip"], "date": dg["date"],
            "year": dg["year"], "month": dg["month"], "day": dg["day"],
            "traveler": dg["travelers"][0] if dg["travelers"] else "", "travelers": dg["travelers"],
            "countries": dg["countries"], "countryKeys": dg["countryKeys"], "regions": dg["regions"],
            "period": dg["period"], "where": dg["where"], "who": dg["who"],
            "body": clean(o.get("body", ""))[:1500], "files": out_files, "filled": dg["filled"], "summary": "",
        })
    # 이미 있는 요약은 살리고, 이름이 바뀐 글의 파일은 옛 이름 → 새 이름으로 바꿉니다
    prev = {}
    gp = os.path.join(OUT, "gri.json")
    if os.path.exists(gp):
        try:
            for r in json.load(io.open(gp, encoding="utf-8")).get("posts", []):
                prev[r["num"]] = r
        except Exception:
            pass
    for r in rows:
        old = prev.get(r["num"])
        if not old:
            continue
        for k in ("summary", "points", "basis"):
            if not r.get(k) and old.get(k):
                r[k] = old[k]
        for f_new in r["files"]:
            f_old = next((x for x in old.get("files", []) if x.get("orig") == f_new["orig"]), None)
            if not f_old or f_old["file"] == f_new["file"]:
                continue
            src = os.path.join(OUT, f_old["file"]); dst = os.path.join(OUT, f_new["file"])
            if os.path.exists(src) and not DRY:
                if os.path.exists(dst):
                    os.remove(dst)            # 방금 원본에서 다시 베껴진 것 — 옛 파일을 새 이름으로 쓰면 됩니다
                os.rename(src, dst)
                ts, td = [os.path.join(TXT, re.sub(r"\.\w+$", "", x) + ".txt") for x in (f_old["file"], f_new["file"])]
                if os.path.exists(ts):
                    if os.path.exists(td):
                        os.remove(td)
                    os.rename(ts, td)
                f_new["size"] = os.path.getsize(dst)
            print(f"  이름 바꿈: {f_old['file'][:50]} → {f_new['file'][:50]}")
    doc = {"note": "경기연구원 해외출장보고 게시판(183건) — 그룹웨어에서 옮김. 이 파일과 PDF 는 비공개 보관함(analysis/travel)에만 둡니다.",
           "made": datetime.date.today().isoformat(), "count": len(rows), "posts": rows}
    if not DRY:
        io.open(gp, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1))
    # 보고
    print(f"글 {len(rows)}건 · 파일 {sum(len(r['files']) for r in rows)}개 · 못 찾은 원본 {len(missing)}")
    for m in missing[:10]:
        print("  없음:", os.path.basename(m))
    weak = [r for r in rows if not r["traveler"] or not r["countries"] or not r["day"]]
    print(f"짐작이 약한 글 {len(weak)}건 (출장자·나라·날짜 가운데 빈 것):")
    for r in weak[:60]:
        print(f"  {r['num']:>3} {r['title'][:70]}  ← {r['postTitle']} | {r['files'][0]['orig'][:40] if r['files'] else '-'}")
    print()
    for r in rows[::15]:
        print(f"  {r['num']:>3} {r['title'][:95]}")

if __name__ == "__main__":
    main()
