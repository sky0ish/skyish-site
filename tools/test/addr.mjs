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

/* ── 얼굴 사진 폴더 훑기 ──
   홈피 폴더의 9.FACE 에 「이름.jpg」 로 넣어 두신 것을 읽습니다.
   진짜 폴더 손잡이 대신 values() 를 가진 시늉을 넘겨 봅니다. */
const dirOf = (entries) => ({
  async *values() { for (const e of entries) yield e; },
});
const f = (name) => ({ kind: "file", name });
const d = (name, kids) => Object.assign(dirOf(kids), { kind: "directory", name });

console.log("\n── 9.FACE 폴더 훑기 ──");
const face = d("9.FACE", [
  f("현병천.jpg"),
  f("서민호_국토연구원.png"),          // 밑줄 뒤는 메모
  f("김고은(부연구위원).jpeg"),         // 괄호 뒤도 메모
  f("읽어주세요.txt"),                 // 그림이 아닌 것
  f("이석준.JPG"),                     // 대문자 확장자
  d("경기도청", [f("홍길동.webp")]),    // 하위 폴더도 한 겹
]);
const m = await AB.collectPhotos(face);
eq("그림만 골라낸다", [...m.keys()].sort(),
   ["김고은", "서민호", "이석준", "현병천", "홍길동"]);
eq("파일까지 들고 온다", m.get("현병천").name, "현병천.jpg");
eq("밑줄 뒤는 뗀다", m.get("서민호").name, "서민호_국토연구원.png");
eq("대문자 확장자도", m.get("이석준").name, "이석준.JPG");
eq("하위 폴더 것도", m.get("홍길동").name, "홍길동.webp");

console.log("\n── 없는 폴더·험한 것 ──");
eq("폴더가 없으면 빈 표", (await AB.collectPhotos(null)).size, 0);
eq("빈 폴더", (await AB.collectPhotos(d("빈곳", []))).size, 0);
eq("그림이 하나도 없으면", (await AB.collectPhotos(d("글만", [f("a.txt")]))).size, 0);
const same = await AB.collectPhotos(d("겹침", [f("가나다.jpg"), f("가나다.png")]));
eq("같은 이름이 둘이면 먼저 것", same.get("가나다").name, "가나다.jpg");

/* ── 붙여넣은 사진을 폴더에 되돌려 저장할 때의 파일 이름 ── */
console.log("\n── 파일 이름 짓기 ──");
eq("사람 이름 그대로", AB.safeFileName("현병천"), "현병천");
eq("사이 띄기는 한 칸으로", AB.safeFileName("홍  길동"), "홍 길동");
eq("파일에 못 쓰는 글자는 밑줄로",
   AB.safeFileName('김/철수:*?"<>|'), "김_철수_______");
eq("앞의 점은 뗀다 (숨은 파일이 되지 않게)", AB.safeFileName("..이석준"), "이석준");
eq("빈 이름", AB.safeFileName(""), "");
eq("아무것도 아닌 것", AB.safeFileName(null), "");
eq("너무 길면 자른다", AB.safeFileName("가".repeat(80)).length, 60);

console.log("\n── 확장자 ──");
eq("png", AB.extOf("image/png"), ".png");
eq("jpeg 는 .jpg 로", AB.extOf("image/jpeg"), ".jpg");
eq("webp", AB.extOf("image/webp"), ".webp");
eq("모르는 것은 png", [AB.extOf("image/bmp"), AB.extOf(""), AB.extOf(null)],
   [".png", ".png", ".png"]);
eq("대문자로 와도", AB.extOf("IMAGE/JPEG"), ".jpg");

console.log("\n── 지은 이름을 다시 읽으면 같은 사람 ──");
/* 붙여넣기로 「현병천.jpg」 를 저장했다면, 폴더를 다시 훑을 때
   같은 이름으로 되찾아져야 합니다 — 안 그러면 다음에 안 뜹니다. */
const made = AB.safeFileName("현병천") + AB.extOf("image/jpeg");
const back = await AB.collectPhotos(d("9.FACE", [f(made)]));
eq("되찾힌다", [...back.keys()], ["현병천"]);
eq("파일 이름", made, "현병천.jpg");

/* ── 칸별로 줄 세우기 ── */
console.log("\n── 줄 세우기 ──");
const L = [
  P({ name: "홍길동", company: "다라건축", title: "대표", mobile: "010-3-3" }),
  P({ name: "강감찬", company: "", title: "부장", mobile: "" }),
  P({ name: "이순신", company: "가나연구원", title: "", mobile: "010-1-1" }),
];
const nm = (l) => l.map((x) => x.name);
eq("이름 오름차순", nm(AB.sortRows(L, "name", 1)), ["강감찬", "이순신", "홍길동"]);
eq("이름 내림차순", nm(AB.sortRows(L, "name", -1)), ["홍길동", "이순신", "강감찬"]);
eq("소속으로 (빈 칸은 맨 뒤)", nm(AB.sortRows(L, "company", 1)),
   ["이순신", "홍길동", "강감찬"]);
eq("소속 거꾸로 해도 빈 칸은 맨 뒤", nm(AB.sortRows(L, "company", -1)),
   ["홍길동", "이순신", "강감찬"]);
eq("연락처로", nm(AB.sortRows(L, "tel", 1)), ["이순신", "홍길동", "강감찬"]);
eq("아무 칸도 안 고르면 그대로", nm(AB.sortRows(L, "", 1)), nm(L));
eq("모르는 칸이면 그대로", nm(AB.sortRows(L, "없는칸", 1)), nm(L));
eq("원본을 건드리지 않는다", (AB.sortRows(L, "name", 1), nm(L)),
   ["홍길동", "강감찬", "이순신"]);

console.log("\n── 사진 칸으로 ──");
const has = (n) => n === "홍길동";
eq("사진 있는 사람이 먼저", nm(AB.sortRows(L, "photo", 1, has)),
   ["홍길동", "강감찬", "이순신"]);
eq("거꾸로 하면 없는 사람이 먼저", nm(AB.sortRows(L, "photo", -1, has)),
   ["강감찬", "이순신", "홍길동"]);
eq("같은 무리 안에서는 원래 차례", nm(AB.sortRows(L, "photo", 1, () => false)), nm(L));

console.log("\n── 험한 것 ──");
eq("빈 목록", AB.sortRows([], "name", 1), []);
eq("아무것도 아닌 것", AB.sortRows(null, "name", 1), []);
eq("이름이 없는 줄이 섞여도",
   AB.sortRows([P({ name: "" }), P({ name: "가" })], "name", 1).map((x) => x.name),
   ["가", ""]);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
