// ─── 주소록 겹침 걷어내기 시험 ──────────────────────────────
//
//   돌리는 법 :  node tools/test/addr.mjs
//
// 리멤버는 내보낼 때마다 새 파일을 만듭니다. 옛 파일이 폴더에 남아 있으면
// 한 사람이 두 줄로 보입니다 (「현병천」 이 두 번 나오던 일).
// 여기 쓰인 이름·회사는 모두 지어낸 것입니다.

/* addressbook.js 는 auth/auth.js 를 들여옵니다 — 시늉으로 막습니다 */
import { readFileSync } from "fs";
const src = readFileSync(new URL("../../assets/js/addressbook.js", import.meta.url), "utf8")
  .replace(/^import \{[^}]*\} from "\.\.\/\.\.\/auth\/auth\.js";$/m,
    "const currentUser = async () => null; const myProfile = async () => null;");
const AB = await import(
  "data:text/javascript;base64," + Buffer.from(src, "utf8").toString("base64"));

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

const P = (o) => Object.assign(
  { src: "card", name: "", company: "", title: "", orgDept: "", email: "",
    mobile: "", phone: "", addr: "", tag: "", at: "" }, o);

console.log("\n── 같은 사람이 두 번 ──");
const twice = [
  P({ name: "현병천", company: "경기도청", title: "기획예산담당관",
      mobile: "010-9257-9198", at: "2026-06-01" }),
  P({ name: "현병천", company: "경기도청", title: "기획예산담당관",
      mobile: "010-9257-9198", at: "2026-06-01" }),
];
eq("한 줄만 남는다", AB.dedupePeople(twice).length, 1);

console.log("\n── 바뀐 것은 새 쪽으로 ──");
const changed = [
  P({ name: "이석준", company: "이천시청", title: "주무관", at: "2025-01-01" }),
  P({ name: "이석준", company: "이천시청", title: "담당관", at: "2026-03-01" }),
];
const one = AB.dedupePeople(changed);
eq("한 줄만", one.length, 1);
eq("새 직함을 남긴다", one[0].title, "담당관");

console.log("\n── 날짜가 같으면 더 채워진 쪽 ──");
const fuller = [
  P({ name: "서민호", company: "국토연구원", at: "2026-01-01" }),
  P({ name: "서민호", company: "국토연구원", at: "2026-01-01",
      mobile: "010-3333-4444", email: "b@krihs.re.kr" }),
];
eq("연락처가 있는 쪽", AB.dedupePeople(fuller)[0].mobile, "010-3333-4444");

console.log("\n── 다른 사람은 안 합칩니다 ──");
const others = [
  P({ name: "김철수", company: "가나건축" }),
  P({ name: "김철수", company: "나다엔지니어링" }),   // 동명이인, 회사가 다름
  P({ src: "alum", name: "김철수", company: "가나건축" }),  // 명함 ↔ 동문은 따로
];
eq("셋 다 남는다", AB.dedupePeople(others).length, 3);

console.log("\n── 차례는 그대로 ──");
eq("처음 나온 차례를 지킨다",
   AB.dedupePeople([P({ name: "가" }), P({ name: "나" }), P({ name: "가" })])
     .map((x) => x.name), ["가", "나"]);

console.log("\n── 사이 띄기·대소문자 ──");
eq("이름 사이 띄기가 달라도 한 사람",
   AB.dedupePeople([P({ name: "홍 길동", company: "가" }),
                    P({ name: "홍길동", company: "가" })]).length, 1);

console.log("\n── 험한 입력 ──");
eq("빈 목록", AB.dedupePeople([]), []);
eq("아무것도 아닌 것", AB.dedupePeople(null), []);
eq("빈 줄이 섞여도", AB.dedupePeople([null, P({ name: "가" })]).length, 1);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
