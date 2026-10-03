// node tools/test/grocery.mjs — 장보기 영수증 읽기·나누기·요리 찾기 시험
import * as G from "../../assets/js/grocery-parse.js";

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log((ok ? "  ✓ " : "  ✗ ") + name + (ok ? "" : "\n      나온 값: " + JSON.stringify(got) + "\n      바란 값: " + JSON.stringify(want)));
};

console.log("── 나누기 ──");
eq("사과", G.classify("사과(부사) 1.5kg"), "fruit");
eq("방울토마토", G.classify("방울토마토 500g"), "fruit");
eq("배추는 야채 (배 아님)", G.classify("알배추"), "veg");
eq("양파", G.classify("국산 양파 3kg"), "veg");
eq("딸기우유는 먹을 것", G.classify("딸기우유 200ml"), "food");
eq("삼겹살", G.classify("한돈 삼겹살"), "food");
eq("두부", G.classify("풀무원 두부"), "food");
eq("휴지는 ETC", G.classify("3겹 화장지 30롤"), "etc");
eq("배송비의 「배」 는 과일 아님", G.classify("배송비"), "etc");
eq("배 한 글자", G.classify("배 2입"), "fruit");

console.log("── 날짜 ──");
eq("2026-10-03", G.dateFrom("판매일 2026-10-03 14:22"), "2026-10-03");
eq("2026.10.3", G.dateFrom("2026.10.3"), "2026-10-03");
eq("파일 이름", G.dateFrom("20261003_142233.jpg"), "2026-10-03");
eq("26.10.03", G.dateFrom("거래일시 26.10.03 12:00"), "2026-10-03");
eq("없으면 빈칸", G.dateFrom("영수증"), "");

console.log("── 영수증 ──");
const lines = [
  "이마트 수원점",
  "[등록]2026-10-03 15:41",
  "상품명 단가 수량 금액",
  "001 사과(부사)1.5kg 9,900 1 9,900",
  "002 *바나나 3,980",
  "003 8801234567890 한돈 삼겹살 600g 15,800",
  "004 양파 3kg 1 5,480",
  "005 3겹 화장지 30롤 12,900",
  "과세물품가액 30,000",
  "부가세 3,000",
  "합 계 48,060",
  "카드결제 48,060",
];
const r = G.parseReceipt(lines);
eq("날짜", r.date, "2026-10-03");
eq("가게 (이름 정리)", r.store, "이마트");
eq("품목", r.items.map((x) => x.name), ["사과(부사)", "바나나", "한돈 삼겹살", "양파", "3겹 화장지"]);
eq("값", r.items.map((x) => x.price), [9900, 3980, 15800, 5480, 12900]);
eq("영수증으로 본다", G.looksLikeReceipt(lines, r), true);
eq("그냥 사진 글자는 영수증 아님", G.looksLikeReceipt(["SALE", "50%"]), false);

console.log("── 요리 ──");
const s = G.suggest(["김치", "돼지 앞다리", "두부", "대파", "계란", "햄"]);
eq("김치찌개가 나온다", s.some((x) => x.dish === "김치찌개"), true);
eq("레시피 고리", s[0].url.startsWith("https://www.10000recipe.com/recipe/list.html?q="), true);
eq("주재료가 없으면 안 나온다", G.suggest(["대파", "양파"]).some((x) => x.dish === "김치찌개"), false);

console.log("── 2주 ──");
eq("오늘 산 것", G.within("2026-10-03", "2026-10-03"), true);
eq("13일 전", G.within("2026-09-20", "2026-10-03"), true);
eq("14일 전은 빠짐", G.within("2026-09-19", "2026-10-03"), false);

console.log("── 내 요리책 ──");
const book = [{ n: "김치찌개", lines: ["김치반포기 · 돼지고기앞다리살300g", "물1리터넣고 양파 · 파넣고", "두부넣고"] },
              { n: "그릭요거트", lines: ["그릭요거트 + 올리브오일 + 꿀", "견과류. 과일"] }];
const m0 = G.ingredientsOf(book[0]).main;
eq("주재료에 김치·돼지·두부", ["김치", "돼지", "두부"].every((w) => m0.includes(w)), true);
eq("양파·파·고기는 주재료 아님", ["양파", "파", "고기"].some((w) => m0.includes(w)), false);
const sb = G.suggestBook(book, ["한돈 앞다리", "풀무원 두부"]);
eq("장본 것으로 요리책 요리가 나온다", sb.map((x) => x.dish), ["김치찌개"]);
eq("겹친 재료에 두부·앞다리", ["두부", "앞다리"].every((w) => sb[0].uses.includes(w)), true);

eq("풀무원의 무는 무가 아님", G.nameHas("풀무원 두부", "무"), false);
eq("한돈 앞다리는 돼지", G.nameHas("한돈 앞다리", "돼지"), true);
eq("새우젓은 새우 재료가 아님", G.ingredientsOf({ n: "김치찌개", lines: ["새우젓한스푼"] }).main.includes("새우"), false);

console.log(bad ? "\n✗ " + bad + " 군데 어긋납니다" : "\n✓ 모두 지납니다");
process.exit(bad ? 1 : 0);
