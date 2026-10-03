// ─── Cost of Living — 카드 이용내역 읽기 · 갈래 나누기 · 합계 (화면 없는 순수 모듈) ───
//
//   fromSheet(rows)       엑셀 「국내이용내역」 장의 줄들 → [{d, t, m, a, x}]
//                         d 날짜 · t 시각 · m 가맹점 · a 금액 · x 취소(전체취소면 true)
//   category(m, fix)      가맹점 → 갈래 키 (fix 는 손으로 바꾼 것 {가맹점: 갈래})
//   byMonth(list, fix)    달마다 합계와 갈래별 합계
//
//   카드번호 · 승인번호는 읽지 않습니다. 이 자료는 이 브라우저 밖으로 나가지 않습니다.
//   tools/test/cost.mjs 로 시험합니다.

export const CATS = [
  { k: "eat",     name: "외식",         color: "#e0675a" },
  { k: "cafe",    name: "카페·빵",      color: "#c98a3f" },
  { k: "grocery", name: "식재료",       color: "#4f9d62" },
  { k: "beauty",  name: "화장품",       color: "#e88fb4" },
  { k: "clothes", name: "의류",         color: "#9a6dae" },
  { k: "office",  name: "사무용품",     color: "#6b7f3a" },
  { k: "online",  name: "온라인쇼핑",   color: "#2f7fb8" },
  { k: "shop",    name: "백화점·몰",    color: "#b07a52" },
  { k: "move",    name: "교통·차량",    color: "#3d867c" },
  { k: "digital", name: "구독·디지털",  color: "#5b6abf" },
  { k: "travel",  name: "여행·숙박",    color: "#d4708f" },
  { k: "culture", name: "문화·여가",    color: "#e6a23c" },
  { k: "study",   name: "교육·학회",    color: "#223a7a" },
  { k: "health",  name: "의료·건강·운동",    color: "#2e9e9a" },
  { k: "life",    name: "생활·서비스",  color: "#8a7a5c" },
  { k: "etc",     name: "기타",         color: "#9a9a9a" },
];
export const CAT_NAME = Object.fromEntries(CATS.map((c) => [c.k, c.name]));
export const CAT_COLOR = Object.fromEntries(CATS.map((c) => [c.k, c.color]));

/* 차례가 중요합니다 — 위에서부터 먼저 맞는 것으로 (「롯데마트」 는 백화점·몰보다 식재료) */
const RULES = [
  ["grocery", /(코리아세븐|마트|홈플러스|이마트|코스트코|트레이더스|하나로|농협|노브랜드|컬리|오아시스|정육|청과|축산|수산|시장|슈퍼|식자재|GS25|지에스25|CU|씨유|세븐일레븐|이마트24|반찬|두레생협|한살림|초록마을)/i],
  ["cafe",    /(설빙|오븐|빙수|젤라또|아이스크림|까페|보이차|홍차|티룸|찻집|다방|카페|cafe|coffee|커피|스타벅스|투썸|탐앤탐스|이디야|메가엠지씨|빽다방|폴바셋|블루보틀|빵|베이커리|bakery|제과|브레드|파리바게|뚜레쥬르|디저트|도넛|케이크|떡집)/i],
  ["beauty",  /(올리브네트웍스|올리브영|겔랑|토니모리|라네즈|헤라|클리오|롬앤|페리페라|마스크|아로마|향수|perfume|올리브영|티르티르|화장품|뷰티|beauty|아모레|이니스프리|세포라|시코르|러쉬|LUSH|닥터자르트|설화수|더페이스샵|미샤|에뛰드|코스메틱|cosmetic)/i],
  ["clothes", /(아울렛|무신사|29CM|H&M|에이치앤엠|유니클로|lululemon|자라|ZARA|에이블리|지그재그|팩토리스토어|스파오|탑텐|나이키|아디다스|뉴발란스|의류|패션|어패럴|구두|슈즈|신발)/i],
  ["office",  /(다이소|알파문구|문구|오피스디포|모닝글로리|핫트랙스|프린터|잉크|토너|사무용품|복사|인쇄|킨코스|교보핫)/i],
  ["online",  /(페이코|PAYCO|토스페이|카카오페이|쿠팡|coupang|네이버파이낸셜|네이버페이|11번가|지마켓|G마켓|옥션|SSG|위메프|티몬|오늘의집|알리익스프레스|테무|아마존|amazon)/i],
  ["digital", /(한글과컴퓨터|한컴|구글|google|adobe|멜론|넷플릭스|netflix|유튜브|youtube|애플|apple|가비아|microsoft|마이크로소프트|openai|chatgpt|anthropic|claude|노션|notion|드롭박스|dropbox|디즈니|웨이브|티빙|왓챠|밀리의서재|리디)/i],
  ["move",    /(터널\/도로|터널|하이패스카드|쏘카|그린카|따릉이|택시|카카오T|카카오모빌리티|티머니|주유소|에너지|오일뱅크|칼텍스|S-?OIL|주차|파킹|철도|코레일|에스알|SRT|고속버스|버스|지하철|하이패스|휴게소|도로공사|세차|타이어|자동차|카센터)/i],
  ["travel",  /(호텔|hotel|익스피디아|expedia|agoda|아고다|씨트립|trip\.com|트립닷컴|에어|항공|airline|숙박|야놀자|여기어때|빌라|리조트|펜션|관광|면세점|airbnb|에어비앤비|부킹|booking)/i],
  ["culture", /(CGV|롯데시네마|메가박스|씨네|영화|공연|전시|미술관|박물관|티켓|뮤지컬|콘서트|오페라|연극|테마파크|에버랜드|롯데월드|아쿠아리움|수목원)/i],
  ["study",   /(문고|스터디|학회|학원|아카데미|academy|클래스|강의|교육|도서|서점|교보|예스24|알라딘|영풍|인터파크도서|세미나|협회)/i],
  ["health",  /(골프|짐|휘트니스|피트니스|스포츠센터|수영|병원|의원|약국|치과|한의원|정형외과|내과|피부과|안과|이비인후과|정관장|헬스|필라테스|요가|검진)/i],
  ["shop",    /(NC|신세계|롯데몰|현대백화점|갤러리아|백화점|스타필드|아이파크몰|몰|무인양품|이케아|IKEA|아울렛)/i],
  ["life",    /(그릇|생활용품|Gardenshop|가든|펫|애견|동물병원|모던하우스|자주|JAJU|서비스센터|미용|헤어|STYLIST|네일|세탁|수선|수리|통신|SKT|KT|LG유플러스|관리비|보험|우체국|택배|꽃|플라워)/i],
  ["eat",     /(훠궈|뚝배기|추어탕|생태|대창|고깃간|뽈찜|부뚜막|메밀|장터|고등어|맥주|캐치테이블|장어|복어|추어|해장국|순두부|두부|만두|쌀국수|타코|파스타|브런치|bistro|trattoria|osteria|식당|국밥|순대|불고기|고기|갈비|돼지|삼겹|쌈밥|칼국수|짬뽕|짜장|중화|반점|설농탕|곰탕|해장|회관|횟집|회센타|보리밥|쭈꾸미|화로|구이|오뎅|육|치킨|피자|버거|김밥|분식|떡볶이|애슐리|비스트로|bistro|레스토랑|스시|초밥|라멘|우동|돈까스|냉면|국수|밥상|한식|양식|일식|주점|포차|호프|비어|와인바|뷔페|샤브|족발|보쌈|막국수|닭|오리|장어|낙지|해물|아구|감자탕|부대찌개|식육|정식|그릴|키친|다이닝|푸드|food)/i],
];

/* 가게 이름으로 정한 규칙 — 공개 코드에 두지 않고 비공개 파일
   10.장보기/카드내역/가맹점분류.json ({"갈래키": ["가게 이름 조각", …]}) 에서 읽어 둡니다 */
let PRIV = [];
export function setPrivate(map) {
  PRIV = [];
  Object.entries(map || {}).forEach(([k, words]) => (words || []).forEach((w) => { if (w) PRIV.push([String(w), k]); }));
  PRIV.sort((a, b) => b[0].length - a[0].length);
}

export function category(m, fix) {
  const name = String(m || "");
  if (fix && fix[name]) return fix[name];
  for (const [w, k] of PRIV) if (name.indexOf(w) >= 0) return k;
  for (const [k, re] of RULES) if (re.test(name)) return k;
  return "etc";
}

/* ── 엑셀 줄 ── 머리줄에서 열 자리를 찾아 읽습니다 (카드사가 열 차례를 바꿔도) */
/** 카드 이름 — 파일 이름에서 (「KB카드이용내역_…xls」 → KB국민, 「SS일시불…xlsx」 → 삼성) */
export function cardOf(fileName) {
  const f = String(fileName || "");
  if (/KB|국민/i.test(f)) return "KB국민";
  if (/^SS|삼성|samsung/i.test(f)) return "삼성";
  if (/신한|shinhan/i.test(f)) return "신한";
  if (/현대|hyundai/i.test(f)) return "현대";
  if (/롯데|lotte/i.test(f)) return "롯데";
  if (/우리|woori/i.test(f)) return "우리";
  if (/하나|hana/i.test(f)) return "하나";
  if (/BC|비씨/i.test(f)) return "BC";
  if (/농협|NH/i.test(f)) return "NH농협";
  return f.replace(/\.[^.]+$/, "").slice(0, 12) || "카드";
}

/* 열 이름 — 카드사마다 다릅니다
   삼성 : 승인일자 · 승인시각 · 가맹점명 · 승인금액(원) · 취소여부 (취소는 음수 줄로 따로)
   KB국민: 이용일 · 이용시간 · 이용하신곳 · 국내이용금액(원) · 상태 (취소면 상태에 「취소」) */
const pickCol = (head, list) => {
  for (const re of list) { const i = head.findIndex((h) => re.test(h)); if (i >= 0) return i; }
  return -1;
};

export function fromSheet(rows, card) {
  const R = Array.isArray(rows) ? rows : [];
  const isHead = (r) => Array.isArray(r) && r.some((c) => /^(승인일자|이용일자|거래일자|이용일|승인일)$/.test(String(c || "").replace(/\s/g, "")));
  const hi = R.findIndex(isHead);
  if (hi < 0) return [];
  const head = R[hi].map((c) => String(c || "").replace(/\s/g, ""));
  const cD = pickCol(head, [/^승인일자$/, /^이용일자$/, /^거래일자$/, /^이용일$/, /^승인일$/]);
  const cT = pickCol(head, [/승인시각/, /이용시각/, /이용시간/, /^시간$/]);
  const cM = pickCol(head, [/^가맹점명$/, /이용하신곳/, /이용처/, /가맹점명/, /상호/]);
  const cA = pickCol(head, [/승인금액/, /국내이용금액/, /^이용금액/, /^금액/]);
  const cX = pickCol(head, [/취소여부/, /^상태$/, /취소/]);
  const statusCol = cX >= 0 && /^상태$/.test(head[cX]);
  const out = [];
  for (let i = hi + 1; i < R.length; i++) {
    const r = R[i] || [];
    if (isHead(r)) continue;
    const d = day(r[cD]);
    const a = num(r[cA]);
    const m = String(r[cM] == null ? "" : r[cM]).replace(/\s+/g, " ").trim();
    if (!d || !m || !a) continue;
    const xs = cX >= 0 ? String(r[cX] || "") : "";
    /* KB 처럼 「상태」 칸에 취소가 적히는 곳은 그 줄의 값이 양수 그대로라 아예 뺍니다 */
    if (statusCol && /취소/.test(xs)) continue;
    const o = { d, t: cT >= 0 ? String(r[cT] || "").slice(0, 5) : "", m, a,
                x: /전체취소/.test(xs) ? 1 : (/부분취소/.test(xs) ? 2 : 0) };
    if (card) o.c = card;
    out.push(o);
  }
  return out;
}

/** 모든 카드가 함께 있는 기간만 — 한 카드만 있는 앞 달은 적게 보이므로 뺍니다
 *  @returns { list, from: "YYYY-MM" | "", dropped: [{c, months:[…]}] } */
export function commonPeriod(list) {
  const L = live(list);
  const first = {};
  L.forEach((x) => { const c = x.c || "카드"; const ym = x.d.slice(0, 7); if (!first[c] || ym < first[c]) first[c] = ym; });
  const cards = Object.keys(first);
  if (cards.length < 2) return { list: L, from: "", dropped: [] };
  const from = cards.map((c) => first[c]).sort().pop();
  const cut = L.filter((x) => x.d.slice(0, 7) < from);
  const dropped = cards.map((c) => ({ c, n: cut.filter((x) => (x.c || "카드") === c && x.a > 0).length }))
    .filter((q) => q.n);
  return { list: L.filter((x) => x.d.slice(0, 7) >= from), from, dropped };
}

function day(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = /(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(String(v || ""));
  return m ? m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0") : "";
}
function num(v) {
  const n = typeof v === "number" ? v : +String(v || "").replace(/[^\d.-]/g, "");
  return isFinite(n) ? Math.round(n) : 0;
}

/** 같은 내역을 두 번 읽어도 한 번만 — 날짜·시각·가맹점·금액이 같으면 같은 줄 */
export function merge(old, add) {
  const key = (x) => x.d + "|" + x.t + "|" + x.m + "|" + x.a;
  const map = new Map((old || []).map((x) => [key(x), x]));
  (add || []).forEach((x) => map.set(key(x), x));
  return [...map.values()].sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
}

/** 셈에 넣을 줄 — 모두 넣습니다.
 *  카드사 내역은 취소를 「원래 결제 줄은 그대로 · 취소 줄을 음수로 따로」 적습니다.
 *  그래서 음수까지 그대로 더해야 카드사 합계와 맞습니다 (2026.01~10 : 28,394,479원). */
export const live = (list) => (list || []);

/** 달마다 — [{ym, total, n, cats:{k: 합계}}] 새 달이 앞 */
export function byMonth(list, fix) {
  const M = new Map();
  live(list).forEach((x) => {
    const ym = x.d.slice(0, 7);
    const o = M.get(ym) || { ym, total: 0, n: 0, cats: {} };
    const k = category(x.m, fix);
    o.total += x.a; if (x.a > 0) o.n++; o.cats[k] = (o.cats[k] || 0) + x.a;
    M.set(ym, o);
  });
  return [...M.values()].sort((a, b) => b.ym.localeCompare(a.ym));
}

/** 가맹점별 — 많이 쓴 차례 */
export function byMerchant(list, fix) {
  const M = new Map();
  live(list).forEach((x) => {
    const o = M.get(x.m) || { m: x.m, a: 0, n: 0, k: category(x.m, fix) };
    o.a += x.a; if (x.a > 0) o.n++;
    M.set(x.m, o);
  });
  return [...M.values()].filter((x) => x.a > 0).sort((a, b) => b.a - a.a);
}

export const won = (n) => Math.round(n || 0).toLocaleString("ko-KR") + "원";
export const man = (n) => (Math.round((n || 0) / 1000) / 10).toLocaleString("ko-KR") + "만원";

/** 최근 n 달 (오래된 달이 앞) — 그래프·표에 쓰는 달 줄 */
export function lastMonths(list, n = 12) {
  const months = byMonth(list).map((x) => x.ym).sort();
  if (!months.length) return [];
  const first = months[0];
  const end = months[months.length - 1];
  const [y, m] = end.split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    if (ym >= first) out.push(ym);                 // 자료가 없는 앞 달은 그리지 않습니다
  }
  return out;
}

/** 항목 × 달 표 — { months, rows:[{k, vals:[..], sum, avg, trend}] }
 *  trend = 최근 3달 평균이 그 앞 3달 평균보다 얼마나 늘었나(비율). 자료가 모자라면 null */
export function matrix(list, fix, n = 12, nowYm) {
  const months = lastMonths(list, n);
  /* 내역의 마지막 날이 그 달의 말일 전이면 「진행 중인 달」 — 추세 셈에서 뺍니다 */
  const lastDay = (live(list).map((x) => x.d).sort().pop()) || "";
  const endYm = months[months.length - 1] || "";
  const dim = endYm ? new Date(+endYm.slice(0, 4), +endYm.slice(5), 0).getDate() : 0;
  const partial = !!endYm && lastDay.slice(0, 7) === endYm && +lastDay.slice(8) < dim;
  const bm = new Map(byMonth(list, fix).map((x) => [x.ym, x]));
  const rows = CATS.map((c) => {
    const vals = months.map((ym) => ((bm.get(ym) || {}).cats || {})[c.k] || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    const used = vals.filter((v, i) => v || months[i] >= (byMonth(list).map((x) => x.ym).sort()[0] || ""));
    const a3 = (arr) => arr.reduce((p, q) => p + q, 0) / (arr.length || 1);
    const full = partial ? vals.slice(0, -1) : vals;
    const last3 = full.slice(-3), prev3 = full.slice(-6, -3);
    const pv = a3(prev3);
    const trend = (prev3.length === 3 && pv > 0) ? (a3(last3) - pv) / pv : null;
    const fv = partial ? vals.slice(0, -1) : vals;
    return { k: c.k, vals, sum, avg: fv.reduce((a, b) => a + b, 0) / (fv.length || 1), trend };
  }).filter((r) => r.sum > 0).sort((a, b) => b.sum - a.sum);
  const totals = months.map((ym) => (bm.get(ym) || {}).total || 0);
  return { months, rows, totals, partial };
}

/** 다 쓴 달만 — 「통계는 달마다 해야 하기 때문에 10월 1~3일치는 삭제하고」
 *  내역의 마지막 날이 그 달 말일 전이면 그 달을 통째로 뺍니다 (자료는 그대로 두고 셈에서만).
 *  @returns { list, cut: null | { ym, from, to, n, sum } } */
export function completeOnly(list) {
  const L = live(list);
  const days = L.map((x) => x.d).sort();
  const last = days[days.length - 1] || "";
  if (!last) return { list: L, cut: null };
  const ym = last.slice(0, 7);
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
  if (+last.slice(8) >= dim) return { list: L, cut: null };
  const out = L.filter((x) => !x.d.startsWith(ym));
  const cutL = L.filter((x) => x.d.startsWith(ym));
  return { list: out, cut: { ym, from: cutL.map((x) => x.d).sort()[0], to: last,
                             n: cutL.filter((x) => x.a > 0).length, sum: cutL.reduce((a, b) => a + b.a, 0) } };
}

/* ── 대분류 — 비슷한 세부 항목을 크게 묶습니다 ── */
export const GROUPS = [
  { g: "food",   name: "식비",          color: "#d9534f", ks: ["eat", "cafe", "grocery"] },
  { g: "shop",   name: "쇼핑",          color: "#8e5ea2", ks: ["online", "clothes", "beauty", "shop", "office"] },
  { g: "move",   name: "교통",          color: "#3d867c", ks: ["move"] },
  { g: "trip",   name: "여가·여행",     color: "#e08a3c", ks: ["travel", "culture"] },
  { g: "self",   name: "자기계발·업무", color: "#223a7a", ks: ["study", "digital"] },
  { g: "living", name: "생활·건강",     color: "#6b8e23", ks: ["life", "health"] },
  { g: "other",  name: "기타",          color: "#9a9a9a", ks: ["etc"] },
];
export const GROUP_OF = Object.fromEntries(GROUPS.flatMap((G) => G.ks.map((k) => [k, G.g])));
export const GROUP_NAME = Object.fromEntries(GROUPS.map((G) => [G.g, G.name]));
export const GROUP_COLOR = Object.fromEntries(GROUPS.map((G) => [G.g, G.color]));

/* 세부 항목마다 무엇이 들어가나 — 화면의 「분류 기준」 표 */
export const DESC = {
  eat:     "식당 · 고깃집 · 국밥 · 면 · 한식/중식/일식/양식 · 주점",
  cafe:    "카페 · 커피 · 빵집 · 디저트 · 빙수",
  grocery: "마트 · 편의점 · 시장 · 정육 · 청과 · 반찬 가게",
  online:  "쿠팡 · 네이버페이 · 11번가 같은 온라인 결제 (무엇을 샀는지는 카드 내역에 안 나옴)",
  clothes: "옷 · 신발 · 아울렛 · 패션 온라인몰",
  beauty:  "화장품 · 뷰티 매장",
  shop:    "백화점 · 복합몰 (어느 매장인지 안 나오는 곳)",
  office:  "문구 · 다이소 · 인쇄 · 복사",
  move:    "택시 · 주유 · 주차 · 철도/SRT · 하이패스 · 휴게소 · 차량 정비",
  travel:  "호텔 · 항공 · 숙박 예약 · 면세점",
  culture: "영화 · 공연 · 전시 · 미술관 · 박물관 · 테마파크",
  study:   "학회비 · 학원 · 강의 · 도서",
  digital: "구글 · Adobe · 음악 · OTT · 도메인 같은 정기 결제",
  life:    "수리 · 미용 · 세탁 · 통신 · 택배 · 생활용품",
  health:  "병원 · 약국 · 건강식품 · 운동",
  etc:     "위 어디에도 들지 않는 곳 — 달 상세에서 갈래를 바꾸면 다음부터 그 갈래로",
};

/** 대분류 표 — matrix() 의 결과를 묶어 같은 꼴로 */
export function groupMatrix(X) {
  const rows = GROUPS.map((G) => {
    const subs = X.rows.filter((r) => GROUP_OF[r.k] === G.g);
    if (!subs.length) return null;
    const vals = X.months.map((_, i) => subs.reduce((a, r) => a + r.vals[i], 0));
    const sum = vals.reduce((a, b) => a + b, 0);
    const n = vals.length;
    const a3 = (arr) => arr.reduce((p, q) => p + q, 0) / (arr.length || 1);
    const last3 = vals.slice(-3), prev3 = vals.slice(-6, -3), pv = a3(prev3);
    return { k: "g:" + G.g, g: G.g, vals, sum, avg: sum / (n || 1),
             trend: (prev3.length === 3 && pv > 0) ? (a3(last3) - pv) / pv : null, subs };
  }).filter(Boolean).sort((a, b) => b.sum - a.sum);
  return { months: X.months, rows, totals: X.totals };
}
