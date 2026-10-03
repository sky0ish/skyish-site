// ─── 장보기 — 영수증 글줄 읽기 · 품목 나누기 · 요리 찾기 (화면 없는 순수 모듈) ───
//
//   parseReceipt(lines)  OCR 로 읽은 글줄 → { date, store, items:[{name, price}] }
//   classify(name)       품목 이름 → "fruit" · "veg" · "food" · "etc"
//   dateFrom(text)       글·파일 이름에서 날짜(YYYY-MM-DD) 찾기
//   suggest(names)       지금 있는 재료로 만들 수 있는 요리 [{dish, uses, missing, url}]
//
//   tools/test/grocery.mjs 로 시험합니다.

export const KINDS = [
  { k: "fruit", name: "과일" },
  { k: "veg",   name: "야채" },
  { k: "food",  name: "다른 먹을 것" },
  { k: "etc",   name: "ETC" },
];

/* 낱말 사전 — 이름 안에 이 말이 들어 있으면 그 갈래로 봅니다 (긴 말을 먼저 봅니다) */
const FRUIT = ["사과", "배", "귤", "감귤", "한라봉", "천혜향", "레드향", "오렌지", "자몽", "레몬", "라임",
  "바나나", "딸기", "포도", "메론", "샤인머스캣", "청포도", "거봉", "수박", "참외", "멜론", "복숭아", "자두",
  "살구", "체리", "블루베리", "라즈베리", "크랜베리", "키위", "골드키위", "망고", "파인애플", "아보카도",
  "석류", "감", "단감", "홍시", "곶감", "대추", "무화과", "매실", "유자", "용과", "리치", "코코넛",
  "토마토", "방울토마토", "대추토마토", "건포도", "푸룬"];
const VEG = ["양파", "대파", "쪽파", "파", "마늘", "생강", "감자", "고구마", "당근", "무", "배추", "알배추",
  "양배추", "적양배추", "브로콜리", "콜리플라워", "시금치", "상추", "깻잎", "쑥갓", "부추", "미나리",
  "청경채", "케일", "로메인", "양상추", "샐러드", "어린잎", "새싹", "오이", "애호박", "호박", "단호박",
  "가지", "피망", "파프리카", "고추", "청양고추", "꽈리고추", "버섯", "표고", "느타리", "새송이",
  "팽이", "양송이", "숙주", "콩나물", "연근", "우엉", "도라지", "더덕", "비트", "셀러리", "아스파라거스",
  "옥수수", "완두", "깍지콩", "고사리", "취나물", "냉이", "달래", "두릅", "열무", "총각무", "얼갈이",
  "갓", "근대", "아욱", "토란", "마", "죽순", "바질", "루꼴라", "허브"];
const FOOD = ["소고기", "한우", "쇠고기", "돼지", "삼겹", "목살", "앞다리", "등심", "안심", "갈비", "불고기",
  "차돌", "양지", "사태", "닭", "닭가슴", "닭다리", "오리", "베이컨", "햄", "소시지", "스팸", "육포",
  "고기", "다짐육", "계란", "달걀", "메추리알", "우유", "두유", "요거트", "요구르트", "치즈", "버터",
  "생크림", "두부", "순두부", "유부", "어묵", "맛살", "생선", "고등어", "연어", "참치", "꽁치", "갈치",
  "조기", "명태", "동태", "오징어", "낙지", "문어", "새우", "게", "꽃게", "조개", "바지락", "홍합",
  "굴", "전복", "멸치", "김", "미역", "다시마", "쌀", "현미", "잡곡", "보리", "귀리", "오트밀", "밀가루",
  "부침가루", "튀김가루", "빵", "식빵", "베이글", "떡", "떡국", "라면", "사발면", "컵라면", "육개장", "쉐이크", "프로틴", "국수", "소면", "우동", "파스타",
  "스파게티", "만두", "김치", "깍두기", "단무지", "반찬", "젓갈", "된장", "고추장", "간장", "쌈장",
  "식초", "설탕", "소금", "후추", "참기름", "들기름", "식용유", "올리브유", "마요네즈", "케첩", "소스",
  "카레", "짜장", "시리얼", "그래놀라", "견과", "아몬드", "호두", "땅콩", "과자", "초콜릿", "아이스크림",
  "주스", "커피", "차", "녹차", "생수", "탄산", "콜라", "사이다", "맥주", "와인", "막걸리", "소주",
  "냉동", "피자", "치킨", "도시락", "샌드위치", "김밥", "통조림", "꿀", "잼", "올리고당", "물엿"];

/* 길게 겹치는 말을 먼저 — 「방울토마토」 가 「토마토」 보다, 「배추」 가 「배」 보다 먼저 */
const DICT = [].concat(
  FRUIT.map((w) => [w, "fruit"]), VEG.map((w) => [w, "veg"]), FOOD.map((w) => [w, "food"]))
  .sort((a, b) => b[0].length - a[0].length);

/* 한 글자 낱말은 이름의 첫머리나 띄어진 낱말일 때만 (「배송」의 배, 「무료」의 무 를 피함) */
const SHORT_OK = (name, w) => {
  if (w.length > 1) return true;
  return new RegExp("(^|[\\s\\(\\[/·,])" + w + "($|[\\s\\)\\]/·,\\d])").test(name);
};

export function classify(name) {
  const n = String(name || "");
  for (const [w, k] of DICT) {
    if (n.indexOf(w) >= 0 && SHORT_OK(n, w)) {
      /* 「사과주스」·「딸기우유」·「포도잼」 처럼 가공품이면 먹을 것으로 */
      if (k === "fruit" || k === "veg") {
        if (/(주스|쥬스|우유|잼|음료|맛|칩|과자|젤리|쨈|에이드|스무디|요거트|시럽|청$|즙|김치|절임|피클|분말|가루)/.test(n)) return "food";
      }
      return k;
    }
  }
  return "etc";
}

/* ── 날짜 ── */
export function dateFrom(text) {
  const s = String(text || "");
  let m = /(20\d\d)[.\-/년\s]{1,2}(\d{1,2})[.\-/월\s]{1,2}(\d{1,2})/.exec(s);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = /(?:^|[^\d])(20\d\d)(\d\d)(\d\d)(?:[^\d]|$)/.exec(s);          // 20261003 · 20261003_142233
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = /(?:^|[^\d])(\d\d)[.\-/](\d\d)[.\-/](\d\d)(?:[^\d]|$)/.exec(s); // 26.10.03 · 26-10-03
  if (m) return ymd(2000 + +m[1], +m[2], +m[3]);
  return "";
}
function ymd(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2015 || y > 2100) return "";
  return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

/* ── 영수증 글줄 ── */
const SKIP = /(합\s*계|총\s*액|소\s*계|부가세|과세|면세|공급가|받을|받은|거스름|결제|카드|승인|할부|현금|포인트|적립|할인|쿠폰|영수증|사업자|대표|전화|TEL|주소|매장|점포|POS|계산원|캐셔|교환|환불|반품|회원|잔액|봉투|봉지|단가|수량|금액|상품명|품명|감사|방문|NO\.|번호|일시|가맹|VAT|합\s*산|에누리|행사|증정|\d{2}:\d{2})/i;
/* 한 줄 꼴의 값 — 이름과 값 사이가 띄어져 있어야 합니다 (「육개장사발면180」 의 180 은 값이 아님) */
const PRICE = /\s(\d{1,3}(?:,\d{3})+|\d{3,7})\s*원?\s*$/;

/** 한 줄에서 품목 이름 다듬기 — 바코드·순번·수량·무게 따위를 걷어 냅니다 */
export function cleanName(s) {
  return String(s || "")
    .replace(/^\s*[\*#]?\s*\d{1,3}[\s.)\]]+/, "")       // 001 · 1. · 12)
    .replace(/\b\d{8,14}\b/g, "")                       // 바코드
    .replace(/[\*※#]/g, " ")
    .replace(/\(?\s*\d+(\.\d+)?\s*(kg|g|ml|l|L|개입|개|봉|팩|입|구|마리|단|포기|통|송이|박스|롤|매|ea|EA)\s*\)?/g, " ")
    .replace(/(\d{1,3}(,\d{3})+|\d{3,})/g, " ")        // 남은 값들
    .replace(/\s+\d{1,2}\s*$/, "")                      // 끝에 붙은 수량
    .replace(/[|_=~<>{}\[\]]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/* OCR 이 「3, 200」 처럼 쉼표 뒤를 띄우거나 「부 가 세」 처럼 글자를 띄우는 일이 잦습니다 */
const norm = (s) => String(s || "")
  .replace(/(\d)\s*,\s*(\d{3})(?!\d)/g, "$1,$2")
  .replace(/[“”‘’„]/g, "")
  .trim();
const tight = (s) => String(s || "").replace(/\s+/g, "");
/* 할인 · 쿠폰 · 행사 줄 — 품목이 아닙니다 (코스트코 IRC · CPN, 이마트 「고래잇 행사」) */
const DISCOUNT = /(IRC|CPN|쿠폰|행사|할인|에누리|포인트|증정|D\/C|DC\b)/i;

/** 값 줄인가 — 「513710  1x  21,790  21,790 T」 · 「8805787957668  4,900  1  4,900」 */
function priceLine(s) {
  const t = norm(s);
  const m = /(-?\d{1,3}(?:,\d{3})+|-?\d{3,7})\s*(-)?\s*[A-Za-zㅣ|ㅠㅜ1]{0,3}\s*$/.exec(t);
  if (!m) return null;
  const head = t.slice(0, m.index);
  if ((head.match(/[가-힣]/g) || []).length >= 2) return null;     // 이름이 같이 있으면 한 줄 꼴
  if (!/\d{3,}/.test(head)) return null;                         // 앞에 바코드·상품번호·단가가 있어야
  const neg = /^-/.test(m[1]) || !!m[2];
  return { amount: +m[1].replace(/[,-]/g, ""), neg };
}

/** 이름 줄 다듬기 — 순번 · 별표 · 앞뒤 OCR 찌꺼기 */
function nameOf(raw) {
  let s = norm(raw)
    .replace(/^[^가-힣A-Za-z0-9]*/, "")
    .replace(/^\d{1,3}\s*[\*xX※]?\s+/, "")                      // 01 · 04* · 04x
    .replace(/^[가-힣]?\s{3,}/, "")                              // 앞에 떨어진 글자 하나
    .replace(/^[A-Za-z]{1,3}\s+(?=[가-힣])/, "")                  // 앞에 붙은 영문 찌꺼기 몇 글자
    .replace(/\s[a-z]{1,3}(?=\s|$)/g, " ")                       // 사이에 낀 소문자 찌꺼기 (「하미 at ofl」)
    .replace(/[£¢€¥©®°±§¶•]/g, "")
    .replace(/\s{2,}.*$/, "")                                    // 뒤에 멀리 떨어진 찌꺼기
    .replace(/[|\\{}\[\]<>~^_=]+/g, " ")
    .replace(/\s+/g, " ").trim();
  /* 「슬 림쉐이 크」 처럼 글자 사이 빈칸 — 한글끼리면 붙입니다 */
  if ((s.match(/[가-힣]\s[가-힣]/g) || []).length >= 2) s = s.replace(/([가-힣])\s(?=[가-힣])/g, "$1");
  return s;
}
const nameLike = (s) => {
  const h = (s.match(/[가-힣]/g) || []).length;
  /* 한글 두 글자 넘게, 아니면 붙은 영문 낱말(4자 넘게)이 있어야 — 「SH KA wo」 같은 찌꺼기는 버립니다 */
  return (h >= 2 || /[A-Za-z]{4,}/.test(s)) && s.length <= 40 &&
         !/(대로|번길|\d+길|서초구|강남구|[가-힣]+구\s|[가-힣]+시\s|MEMBER|회원|만료|사업자|대표|TEL|전화)/i.test(s);
};

export function parseReceipt(lines) {
  const L = (Array.isArray(lines) ? lines : String(lines || "").split(/\r?\n/))
    .map((x) => norm(x)).filter(Boolean);
  const all = L.join("\n");
  const date = dateFrom(all);
  /* 가게 — OCR 이 첫 글자를 자주 놓쳐(「는 스트코」) 이름 조각으로 알아봅니다 */
  const STORES = [[/코스트코|스트코|COSTCO|WHOLESALE/i, "코스트코"], [/트레이더스/, "트레이더스"], [/이마트|신세계포인트/, "이마트"],
                  [/홈플러스/, "홈플러스"], [/롯데마트/, "롯데마트"], [/하나로|농협/, "하나로마트"], [/노브랜드/, "노브랜드"],
                  [/컬리/, "컬리"], [/쿠팡/, "쿠팡"], [/올리브영/, "올리브영"], [/다이소/, "다이소"]];
  const hit = STORES.find(([re]) => re.test(all));
  const store = hit ? hit[1] : "";
  const items = [], seen = new Set();
  const push = (name, price) => {
    if (!name || !nameLike(name) || DISCOUNT.test(name) || SKIP.test(tight(name))) return;
    if (price < 100 || price > 2000000 || seen.has(name)) return;
    seen.add(name);
    items.push({ name, price });
  };
  /* 품목은 「판매」·「상품명」 줄 다음부터 — 그 위는 가게 · 주소 · 회원번호 */
  const startAt = L.findIndex((x) => /^(판매|상품명|품명|\[?구\s*매\]?)/.test(tight(x)) || /상품명|단가수량/.test(tight(x)));
  let pending = "";
  for (const raw of (startAt >= 0 ? L.slice(startAt + 1) : L)) {
    const t = tight(raw);
    if (/^(\*+)?(합계|결제대상|결제금액|받을금액|총구매)/.test(t)) break;         // 여기부터는 품목이 아닙니다
    if (/^(\(\*\))?(과세|면세|부가세)/.test(t)) { pending = ""; continue; }
    if (SKIP.test(t) && !priceLine(raw)) { pending = ""; continue; }
    /* ① 이름 줄 다음의 값 줄 (코스트코 · 이마트) */
    const pl = priceLine(raw);
    if (pl) {
      if (pending && !pl.neg) push(pending, pl.amount);
      pending = "";
      continue;
    }
    /* ② 한 줄 안에 이름과 값 */
    const pm = PRICE.exec(raw);
    if (pm) {
      const nm = cleanName(raw.slice(0, pm.index));
      if (nameLike(nm) && !SKIP.test(tight(raw))) { push(nameOf(nm), +pm[1].replace(/,/g, "")); pending = ""; continue; }
    }
    /* ③ 이름일 수 있는 줄 — 다음 값 줄을 기다립니다 */
    const nm = nameOf(raw);
    pending = nameLike(nm) && !DISCOUNT.test(nm) ? nm : "";
  }
  return { date, store, items };
}

/** 영수증처럼 보이는가 — 값이 붙은 품목 줄이 둘 넘고, 영수증 낱말이 하나라도 */
export function looksLikeReceipt(lines, parsed) {
  const t = (Array.isArray(lines) ? lines : [String(lines || "")]).join(" ");
  const p = parsed || parseReceipt(lines);
  return p.items.length >= 2 && /(합\s*계|결제|카드|영수|부가세|과세|면세|금액|총액|POS)/i.test(t);
}

/* ── 요리 ── 재료(어느 하나라도 있으면 됨 · 「|」)와 함께 */
export const RECIPES = [
  ["김치찌개", ["김치", "돼지|두부|참치", "양파|대파|파"]],
  ["된장찌개", ["된장", "두부|애호박|감자", "양파|대파|파|고추"]],
  ["순두부찌개", ["순두부", "계란|달걀|바지락|조개|돼지", "대파|파|양파"]],
  ["부대찌개", ["햄|소시지|스팸", "김치", "라면|두부|대파"]],
  ["제육볶음", ["돼지|앞다리|목살", "고추장", "양파|대파|당근"]],
  ["불고기", ["불고기|소고기|한우|쇠고기", "간장", "양파|대파|당근|버섯"]],
  ["소고기무국", ["소고기|양지|한우|쇠고기", "무", "대파|마늘"]],
  ["미역국", ["미역", "소고기|양지|조개|홍합", "참기름|간장"]],
  ["닭볶음탕", ["닭", "감자", "당근|양파|대파"]],
  ["찜닭", ["닭", "감자|당근", "간장|당면"]],
  ["삼계탕", ["닭", "마늘|대추|인삼", "대파|찹쌀"]],
  ["카레라이스", ["카레", "감자|당근|양파", "돼지|닭|소고기"]],
  ["짜장밥", ["짜장", "양파|감자|양배추", "돼지|애호박"]],
  ["잡채", ["당면", "시금치|당근|양파|버섯|파프리카", "소고기|돼지"]],
  ["비빔밥", ["계란|달걀", "고추장", "시금치|콩나물|당근|애호박|버섯|상추"]],
  ["김치볶음밥", ["김치", "계란|달걀", "햄|스팸|참치|베이컨"]],
  ["계란말이", ["계란|달걀", "대파|파|당근|양파"]],
  ["계란찜", ["계란|달걀", "대파|파|새우"]],
  ["감자조림", ["감자", "간장", "양파|당근"]],
  ["감자볶음", ["감자", "양파|당근|피망|파프리카"]],
  ["애호박볶음", ["애호박|호박", "양파|새우|마늘"]],
  ["가지볶음", ["가지", "간장|굴소스|소스", "양파|대파|마늘"]],
  ["시금치나물", ["시금치", "참기름|마늘|간장"]],
  ["콩나물무침", ["콩나물", "참기름|대파|마늘"]],
  ["콩나물국", ["콩나물", "대파|마늘|고추"]],
  ["오이무침", ["오이", "양파|고추장|식초"]],
  ["두부조림", ["두부", "간장", "대파|양파|고추"]],
  ["어묵볶음", ["어묵", "양파|당근|대파|고추"]],
  ["고등어조림", ["고등어", "무|감자", "양파|대파|간장"]],
  ["연어스테이크", ["연어", "레몬|아스파라거스|양파|버터"]],
  ["새우볶음밥", ["새우", "계란|달걀", "양파|당근|대파|파프리카"]],
  ["오징어볶음", ["오징어", "고추장", "양파|대파|당근|양배추"]],
  ["해물파전", ["부침가루|밀가루", "쪽파|대파|파|부추", "오징어|새우|조개|홍합"]],
  ["부추전", ["부추", "부침가루|밀가루", "고추|양파|오징어"]],
  ["감자전", ["감자", "양파|부침가루|소금"]],
  ["떡볶이", ["떡", "고추장", "어묵|대파|양배추|계란|달걀"]],
  ["떡국", ["떡국|떡", "소고기|양지|계란|달걀", "대파|김"]],
  ["잔치국수", ["소면|국수", "애호박|계란|달걀|김", "멸치|다시마|대파"]],
  ["비빔국수", ["소면|국수", "고추장|식초", "오이|김치|계란|상추"]],
  ["라볶이", ["라면", "떡", "고추장|어묵|대파"]],
  ["토마토 파스타", ["파스타|스파게티", "토마토|소스", "양파|마늘|베이컨"]],
  ["알리오 올리오", ["파스타|스파게티", "마늘", "올리브유|고추|베이컨"]],
  ["크림 파스타", ["파스타|스파게티", "생크림|우유", "베이컨|버섯|양파"]],
  ["오믈렛", ["계란|달걀", "양파|버섯|햄|치즈|파프리카|토마토"]],
  ["프렌치토스트", ["식빵|빵", "계란|달걀", "우유|버터"]],
  ["샌드위치", ["식빵|빵", "햄|계란|달걀|치즈", "양상추|상추|토마토|오이"]],
  ["그린 샐러드", ["양상추|로메인|어린잎|샐러드|상추|루꼴라|케일", "토마토|오이|파프리카|아보카도|치즈"]],
  ["카프레제", ["토마토", "치즈", "바질|올리브유"]],
  ["과일 샐러드", ["사과|배|바나나|딸기|키위|포도|귤|오렌지|망고|블루베리|파인애플", "요거트|요구르트|꿀"]],
  ["바나나 스무디", ["바나나", "우유|요거트|요구르트|두유"]],
  ["딸기 요거트", ["딸기", "요거트|요구르트"]],
  ["사과 당근 주스", ["사과", "당근"]],
  ["토마토 달걀볶음", ["토마토", "계란|달걀", "대파|파|양파"]],
  ["양배추 쌈", ["양배추", "쌈장|된장|고추장", "밥|쌀"]],
  ["버섯볶음", ["버섯|표고|느타리|새송이|팽이|양송이", "양파|마늘|간장|버터"]],
  ["브로콜리 볶음", ["브로콜리", "마늘|새우|베이컨|굴소스"]],
  ["고구마 맛탕", ["고구마", "설탕|올리고당|물엿|꿀"]],
  ["단호박찜", ["단호박", "꿀|우유|치즈"]],
  ["무생채", ["무", "고춧가루|식초|설탕|대파"]],
  ["배추된장국", ["배추|얼갈이|알배추", "된장", "대파|두부|멸치"]],
  ["육개장", ["소고기|양지|사태", "고사리|숙주|대파", "고추|토란"]],
  ["갈비찜", ["갈비", "무|당근|밤|대추", "간장"]],
  ["삼겹살 구이", ["삼겹", "상추|깻잎|마늘|쌈장|양파"]],
  ["닭가슴살 샐러드", ["닭가슴", "양상추|로메인|어린잎|샐러드|오이|토마토"]],
  ["참치마요덮밥", ["참치", "마요네즈", "김|계란|양파"]],
  ["유부초밥", ["유부", "밥|쌀|단무지|당근"]],
  ["김밥", ["김", "단무지|햄|계란|달걀|시금치|당근|오이|맛살"]],
  ["만둣국", ["만두", "떡|계란|달걀", "대파|김"]],
  ["바지락 칼국수", ["바지락|조개", "국수|칼국수", "애호박|대파|감자"]],
];

/** 지금 있는 재료로 만들 수 있는 요리 — 재료 묶음을 몇 개 채우는지로 줄을 세웁니다 */
export function suggest(names, limit = 12) {
  const have = (Array.isArray(names) ? names : []).map((x) => String(x || ""));
  const hit = (alts) => alts.split("|").find((a) => have.some((h) => nameHas(h, a))) || "";
  const out = [];
  for (const [dish, groups] of RECIPES) {
    const uses = [], missing = [];
    groups.forEach((g) => { const h = hit(g); if (h) uses.push(h); else missing.push(g.split("|")[0]); });
    /* 묶음의 절반 넘게, 그리고 첫 묶음(주재료)은 꼭 있어야 */
    if (!uses.length || !hit(groups[0])) continue;
    const score = uses.length / groups.length;
    if (score < 0.5) continue;
    out.push({ dish, uses, missing, score, url: recipeUrl(dish) });
  }
  out.sort((a, b) => b.score - a.score || b.uses.length - a.uses.length || a.dish.localeCompare(b.dish));
  return out.slice(0, limit);
}

export const recipeUrl = (dish) =>
  "https://www.10000recipe.com/recipe/list.html?q=" + encodeURIComponent(dish);

/** 산 날로부터 며칠 보여 줄지 — 「2주정도 그 항목이 유지」 */
export const KEEP_DAYS = 14;
export function within(dateStr, today, days = KEEP_DAYS) {
  if (!dateStr) return false;
  const t = new Date((today || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  const diff = (t - d) / 864e5;
  return diff >= 0 && diff < days;
}

/* ── 내 요리책(10.장보기/레시피.json) ── 「요리 Recipe 는 올려둔 pdf 파일을 참고해」
   요리마다 글 속에서 재료 낱말을 찾아 두고, 장본 것과 겹치는 만큼 줄을 세웁니다.
   양념(간장·설탕…)과 늘 있는 것(마늘·파·양파)은 「주재료」 로 세지 않습니다. */
const SEASONING = /^(간장|진간장|국간장|어간장|설탕|소금|후추|식초|참기름|들기름|식용유|올리브유|마요네즈|케첩|소스|꿀|올리고당|물엿|고추장|된장|쌈장|김|깨|통깨|맛술|미림|청주|소주)$/;
const STAPLE = /^(마늘|파|대파|쪽파|양파|생강|고추|청양고추|고기|반찬|소스|냉동)$/;

/* 「새우젓」·「참치액」·「고추가루」·「매실청」·「멸치다시다」 처럼 양념으로 쓰인 자리는 재료로 안 셉니다 */
const AS_SEASONING = /^(젓|액|가루|즙|청|스톡|다시|소스|파우더|기름|오일)/;
function realUse(text, w) {
  let i = text.indexOf(w);
  while (i >= 0) {
    if (!AS_SEASONING.test(text.slice(i + w.length, i + w.length + 3))) return true;
    i = text.indexOf(w, i + 1);
  }
  return false;
}

/* 같은 것을 다르게 부르는 이름 — 장본 이름과 요리책 낱말을 맞춰 봅니다 */
const SAME = {
  "돼지": /(돼지|돈육|한돈|앞다리|삼겹|목살|뒷다리|항정)/,
  "소고기": /(소고기|쇠고기|한우|우육|차돌|양지|사태|등심|안심|불고기)/,
  "계란": /(계란|달걀|란\s*\d+구)/,
  "달걀": /(계란|달걀)/,
  "닭": /(닭|치킨|닭가슴)/,
};
/** 장본 이름 h 가 재료 낱말 w 인가 — 한 글자 낱말은 띄어진 낱말일 때만 (「풀무원」의 무 X) */
export function nameHas(h, w) {
  if (SAME[w] && SAME[w].test(h)) return true;
  if (h.indexOf(w) < 0) return false;
  return SHORT_OK(h, w);
}

export function ingredientsOf(recipe) {
  const text = (recipe.n || "") + " " + (recipe.lines || []).join(" ");
  const found = [];
  for (const [w, k] of DICT) {
    if (text.indexOf(w) < 0 || !SHORT_OK(text, w) || !realUse(text, w)) continue;
    if (found.some((f) => f.indexOf(w) >= 0)) continue;          // 「방울토마토」 를 찾았으면 「토마토」 는 또 안 셈
    found.push(w);
  }
  const main = found.filter((w) => !SEASONING.test(w) && !STAPLE.test(w));
  return { all: found, main };
}

/** 내 요리책에서 — 장본 것이 주재료로 들어가는 요리 */
export function suggestBook(recipes, names, limit = 16) {
  const have = (Array.isArray(names) ? names : []).map((x) => String(x || ""));
  const has = (w) => have.some((h) => nameHas(h, w));
  const out = [];
  (Array.isArray(recipes) ? recipes : []).forEach((r, i) => {
    const ing = ingredientsOf(r);
    if (!ing.main.length) return;
    const uses = ing.main.filter(has);
    if (!uses.length) return;
    out.push({ dish: r.n, i, uses, missing: ing.main.filter((w) => !has(w)),
               score: uses.length / ing.main.length, url: recipeUrl(r.n.replace(/^(천상현|어남선생|백종원|이정현)\s*/, "")) });
  });
  out.sort((a, b) => b.uses.length - a.uses.length || b.score - a.score || a.dish.localeCompare(b.dish));
  return out.slice(0, limit);
}
