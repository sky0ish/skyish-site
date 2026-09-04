// ─── 일정의 사람 ↔ 명함첩 짝짓기 시험 ───────────────────────
//
//   돌리는 법 :  node tools/test/cards.mjs
//
// 여기 쓰인 이름·회사는 모두 지어낸 것입니다 — 진짜 명함첩은
// 내 컴퓨터에만 있고 저장소에 올라가지 않습니다.

import { splitPeople, buildIndex, matchPeople, cardsForDay, cardFace, cardDetail, keyOf }
  from "../../assets/js/notes-cards.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

const CARDS = [
  { src: "card", name: "이석준", company: "이천시청", orgDept: "군협력담당관실",
    title: "담당관", mobile: "010-1111-2222", phone: "031-000-0000",
    email: "a@icheon.go.kr", addr: "경기 이천시", tag: "지자체", at: "2026-03-01" },
  { src: "card", name: "서민호", company: "국토연구원", orgDept: "도시연구본부",
    title: "연구위원", mobile: "010-3333-4444", email: "b@krihs.re.kr" },
  /* 동명이인 — 두 장이 걸립니다 */
  { src: "card", name: "김철수", company: "가나건축", title: "대표" },
  { src: "card", name: "김철수", company: "나다엔지니어링", title: "부장" },
  /* 동문 명부에서 온 것 — 명함첩이 아니므로 표에 넣지 않습니다 */
  { src: "alum", name: "박동문", company: "동경대" },
  { src: "card", name: "", company: "이름없는회사" },      // 이름이 없으면 뺍니다
];

console.log("\n── 이름 끊어내기 ──");
eq("괄호 소속을 뗀다", splitPeople("이석준 (이천시청)"), ["이석준"]);
eq("쉼표로 여럿", splitPeople("서민호, 김고은"), ["서민호", "김고은"]);
eq("직함이 붙어 있어도", splitPeople("남지현 경기연구원 선임연구위원"), ["남지현"]);
eq("가운뎃점도 끊는다", splitPeople("이석준 · 서민호"), ["이석준", "서민호"]);
eq("같은 사람은 한 번만", splitPeople("이석준, 이석준 (이천시청)"), ["이석준"]);
eq("빈 칸", splitPeople(""), []);
eq("아무것도 아닌 것", splitPeople(null), []);

console.log("\n── 명함첩 표 만들기 ──");
const idx = buildIndex(CARDS);
eq("이름 수", idx.size, 3);
eq("동문 명부는 안 들어온다", idx.has(keyOf("박동문")), false);
eq("이름 없는 것도 안 들어온다", [...idx.keys()].includes(""), false);
eq("동명이인은 두 장", (idx.get(keyOf("김철수")) || []).length, 2);

console.log("\n── 글의 사람과 맞추기 ──");
eq("한 사람", matchPeople("이석준 (이천시청)", idx).map((x) => x.name), ["이석준"]);
eq("걸린 것만 남는다",
   matchPeople("이석준, 없는사람, 서민호", idx).map((x) => x.name), ["이석준", "서민호"]);
eq("딱 한 장이면 one 이 찬다",
   matchPeople("서민호", idx)[0].one.company, "국토연구원");
eq("동명이인이면 one 은 비운다", matchPeople("김철수", idx)[0].one, null);
eq("동명이인은 두 장을 다 준다", matchPeople("김철수", idx)[0].cards.length, 2);
eq("표가 비면 아무것도 안 한다", matchPeople("이석준", new Map()), []);
eq("표가 없어도 안 터진다", matchPeople("이석준", null), []);

console.log("\n── 그날 것 모으기 ──");
const DAY = [
  { id: "1", people: "이석준 (이천시청), 서민호" },
  { id: "2", people: "서민호, 김철수" },          // 서민호는 이미 나왔습니다
  { id: "3", people: "" },
  { id: "4" },                                    // people 칸이 아예 없어도
];
eq("그날 만난 사람", cardsForDay(DAY, idx).map((x) => x.name),
   ["이석준", "서민호", "김철수"]);
eq("빈 날", cardsForDay([], idx), []);
eq("아무것도 아닌 것", cardsForDay(null, idx), []);

console.log("\n── 명함에 찍을 것 ──");
const face = cardFace(CARDS[0]);
eq("이름·직함·회사", [face.name, face.title, face.company], ["이석준", "담당관", "이천시청"]);
eq("연락처 줄", face.lines, ["010-1111-2222", "031-000-0000", "a@icheon.go.kr"]);
eq("아직 스캔 그림은 없다", face.image, "");
eq("빈 칸은 빠진다", cardFace(CARDS[2]).lines, []);
eq("아무것도 아닌 것도 견딘다", cardFace(null).name, "");

console.log("\n── 자세히 보기 ──");
eq("있는 칸만 나온다", cardDetail(CARDS[1]).map(([k]) => k),
   ["회사", "부서", "직함", "휴대폰", "메일"]);
eq("값도 함께", cardDetail(CARDS[1])[0], ["회사", "국토연구원"]);
eq("빈 명함", cardDetail(null), []);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
