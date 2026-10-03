// node tools/test/cost.mjs — Cost of Living 카드 내역 읽기·나누기 시험
import * as C from "../../assets/js/cost-parse.js";

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log((ok ? "  ✓ " : "  ✗ ") + name + (ok ? "" : "\n      나온 값: " + JSON.stringify(got) + "\n      바란 값: " + JSON.stringify(want)));
};

console.log("── 갈래 ──");
eq("쿠팡", C.category("쿠팡"), "online");
eq("롯데마트는 장보기", C.category("예시(롯데마트)역점"), "grocery");
eq("빵", C.category("예시빵집"), "cafe");
eq("택시", C.category("카카오T일반택시"), "move");
eq("주유소", C.category("예시주유소"), "move");
eq("구글", C.category("구글페이먼트코리아"), "digital");
eq("호텔스닷컴", C.category("호텔스닷컴"), "travel");
eq("학회", C.category("(사) 예시학회"), "study");
eq("순대국", C.category("예시순대국"), "eat");
eq("아울렛은 의류", C.category("예시아울렛"), "clothes");
eq("무신사는 의류", C.category("(주)무신사"), "clothes");
eq("올리브영은 화장품", C.category("올리브영 강남점"), "beauty");
eq("티르티르는 화장품", C.category("티르티르 예시점"), "beauty");
eq("다이소는 사무용품", C.category("다이소 서초점"), "office");
eq("스타필드는 백화점·몰", C.category("스타필드 예시점"), "shop");
eq("손으로 바꾼 것이 이긴다", C.category("쿠팡", { "쿠팡": "grocery" }), "grocery");
eq("모르면 기타", C.category("예시빌라"), "travel");

console.log("── 엑셀 줄 ──");
const rows = [
  ["카드번호", "본인가족구분", "승인일자", "승인시각", "가맹점명", "승인금액(원)", "일시불할부구분", "할부개월", "승인번호", "취소여부"],
  ["0000******0000", "가족", "2026.10.02", "12:00:00", "예시순대국", 48000, "일시불", "0", "11111111", "-"],
  ["0000******0000", "가족", "2026.10.01", "09:00:00", "예시주유소", 70000, "일시불", "0", "22222222", "-"],
  ["0000******0000", "가족", "2026.09.30", "10:00:00", "쿠팡", 30000, "일시불", "0", "1", "-"],
  ["0000******0000", "가족", "2026.09.30", "10:05:00", "쿠팡", -30000, "일시불", "0", "1", "전체취소"],
];
const L = C.fromSheet(rows);
eq("네 줄", L.length, 4);
eq("카드번호·승인번호는 담지 않는다", Object.keys(L[0]).sort(), ["a", "d", "m", "t", "x"]);
eq("날짜 꼴", L[0].d, "2026-10-02");
eq("전체취소 표시", L[3].x, 1);
const M = C.byMonth(L);
eq("달마다 — 취소 음수 줄까지 더해 9월은 0", M.map((x) => [x.ym, x.total]), [["2026-10", 118000], ["2026-09", 0]]);
eq("갈래 합계", M[0].cats, { eat: 48000, move: 70000 });
eq("두 번 읽어도 한 번", C.merge(L, L).length, 4);

console.log("── 1년 표 ──");
const many = [];
for (let m = 1; m <= 10; m++) many.push({ d: "2026-" + String(m).padStart(2, "0") + "-05", t: "", m: "쿠팡", a: m * 1000, x: 0 },
                                        { d: "2026-" + String(m).padStart(2, "0") + "-06", t: "", m: "서초주유소", a: 50000, x: 0 });
const X = C.matrix(many, null, 12);
eq("자료가 시작된 1월부터 10달", X.months.length, 10);
eq("끝 달은 10월", X.months[9], "2026-10");
eq("쿠팡 10월", X.rows.find((r) => r.k === "online").vals[9], 10000);
eq("늘어나는 항목은 trend > 0", X.rows.find((r) => r.k === "online").trend > 0, true);
eq("같은 항목은 trend 0", X.rows.find((r) => r.k === "move").trend, 0);

console.log("── 다 쓴 달만 ──");
const part = [{ d: "2026-09-10", t: "", m: "예시식당", a: 10000, x: 0 }, { d: "2026-09-30", t: "", m: "예시식당", a: 5000, x: 0 },
              { d: "2026-10-01", t: "", m: "예시식당", a: 7000, x: 0 }, { d: "2026-10-03", t: "", m: "예시카페", a: 3000, x: 0 }];
const cc = C.completeOnly(part);
eq("10월 1~3일은 뺀다", cc.list.map((x) => x.d), ["2026-09-10", "2026-09-30"]);
eq("뺀 것 알림", [cc.cut.ym, cc.cut.from, cc.cut.to, cc.cut.n, cc.cut.sum], ["2026-10", "2026-10-01", "2026-10-03", 2, 10000]);
eq("말일까지 있으면 그대로", C.completeOnly(part.slice(0, 2)).cut, null);

console.log(bad ? "\n✗ " + bad + " 군데 어긋납니다" : "\n✓ 모두 지납니다");
process.exit(bad ? 1 : 0);
