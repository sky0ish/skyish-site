// ─── 주소록 겹침 걷어내기 시험 ──────────────────────────────
//
//   돌리는 법 :  node tools/test/addr.mjs
//
// 리멤버는 내보낼 때마다 새 파일을 만듭니다. 옛 파일이 폴더에 남아 있으면
// 한 사람이 두 줄로 보입니다 (「현병천」 이 두 번 나오던 일).
// 여기 쓰인 이름·회사는 모두 지어낸 것입니다.

/* addressbook.js 는 auth/auth.js 를 들여옵니다 — 시늉으로 막습니다 */
import { readFileSync } from "fs";
/* addr-pack.js 는 진짜를 씁니다 (셈 자체는 tools/test/addr-pack.mjs 가 봅니다).
   data: 꼴 안에서는 상대 경로가 풀리지 않아, 그 파일을 통째로 심어 넣습니다.
   addr-pack.js 는 아무것도 들여오지 않아 이렇게 해도 됩니다. */
const packUrl = "data:text/javascript;base64," + Buffer.from(
  readFileSync(new URL("../../assets/js/addr-pack.js", import.meta.url), "utf8"), "utf8")
  .toString("base64");
const src = readFileSync(new URL("../../assets/js/addressbook.js", import.meta.url), "utf8")
  .replace(/^import \{[^}]*\} from "\.\.\/\.\.\/auth\/auth\.js";$/m,
    "const currentUser = async () => null; const myProfile = async () => null;")
  /* 들여오기가 여러 줄로 접혀 있어도 잡습니다 */
  .replace(/^(import \{[\s\S]*?\} from )"\.\/addr-pack\.js[^"]*";$/m,
    (all, head) => head + JSON.stringify(packUrl) + ";");
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
/* 파일 이름의 밑줄·괄호 뒤는 **소속**입니다.
   전에는 그것을 버리고 이름만 열쇠로 썼습니다. 그래서 「NT로봇 대표 김경환」 의
   얼굴이 「경기도청 김경환」 께 붙었습니다. 이제 소속까지 열쇠에 담습니다. */
const face = d("9.FACE", [
  f("현병천.jpg"),                      // 소속 없음 — 누구에게나 붙는 옛 꼴
  f("서민호_국토연구원.png"),          // 밑줄 뒤는 소속
  f("김고은(부연구위원).jpeg"),         // 괄호 안도 소속
  f("읽어주세요.txt"),                 // 그림이 아닌 것
  f("이석준.JPG"),                     // 대문자 확장자
  d("경기도청", [f("홍길동.webp")]),    // 하위 폴더도 한 겹
]);
const m = await AB.collectPhotos(face);
eq("그림만 골라낸다", [...m.keys()].sort(),
   ["김고은|부연구위원", "서민호|국토연구원", "이석준", "현병천", "홍길동"]);
eq("파일까지 들고 온다", m.get("현병천").name, "현병천.jpg");
eq("밑줄 뒤는 소속으로", m.get("서민호|국토연구원").name, "서민호_국토연구원.png");
eq("괄호 안도 소속으로", m.get("김고은|부연구위원").name, "김고은(부연구위원).jpeg");
eq("대문자 확장자도", m.get("이석준").name, "이석준.JPG");
eq("하위 폴더 것도", m.get("홍길동").name, "홍길동.webp");

console.log("\n── 폴더의 그림을 정말로 지웁니다 ──");
/* 전에는 브라우저 안 사본만 지워, 「사진 지우기」 를 눌러도 폴더에서 다시 읽혀
   얼굴이 그대로 돌아왔습니다. 지우려면 그 파일이 어느 폴더에 있는지 알아야 합니다. */
{
  const del = { done: [] };
  const one = {
    kind: "directory", name: "9.FACE",
    values: async function* () { yield f("이석준_경기연구원.jpg"); },
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    removeEntry: async (nm) => { del.done.push(nm); },
  };
  const mm = await AB.collectPhotos(one);
  const it = mm.get("이석준|경기연구원");
  eq("어느 폴더의 것인지 적어 둔다", !!(it && it.dir), true);
  eq("파일 이름도 적어 둔다", it && it.name, "이석준_경기연구원.jpg");
  eq("파일 손잡이도 그대로", !!(it && it.fh), true);
  /* 정말로 폴더에서 지웁니다 */
  eq("지운 파일 이름을 돌려준다", await AB.deleteFolderEntry(it), "이석준_경기연구원.jpg");
  eq("그 파일을 지웠다", del.done, ["이석준_경기연구원.jpg"]);
}

console.log("\n── 쓰기를 허락 안 하시면 안 지웁니다 ──");
{
  const no = { done: [] };
  const it = { name: "가나.jpg", dir: {
    queryPermission: async () => "prompt",
    requestPermission: async () => "denied",
    removeEntry: async (n) => { no.done.push(n); },
  } };
  eq("빈 글자를 돌려준다", await AB.deleteFolderEntry(it), "");
  eq("아무것도 안 지웠다", no.done, []);
  eq("아무것도 아닌 것", [await AB.deleteFolderEntry(null),
                          await AB.deleteFolderEntry({ name: "x" })], ["", ""]);
}

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

/* ── 완전히 같은 분을 한 줄로 ──
   「완전히 같은건 데이타 베이스에서 아예 삭제해주고」
   같은 분이 명함첩과 동문 명부에 나란히 실릴 때만 합칩니다. */
console.log("\n── 완전히 같은 분 합치기 ──");
const 명함 = P({ name: "고동희", company: "삼성물산", title: "담당차장",
                 mobile: "010-6294-5086", email: "dongh.ko@samsung.com" });
const 동문 = P({ src: "alum", kind: "alum", name: "고동희", company: "삼성물산",
                 mobile: "010-6294-5086", majorName: "사회기반학전공",
                 univDept: "공학부", email: "" });
const 합침 = AB.mergeSame([동문, 명함]);
eq("★ 한 줄로 합친다", 합침.length, 1);
eq("★ 동문 명부의 전공이 안 사라진다", 합침[0].majorName, "사회기반학전공");
eq("명함첩의 직함도 살아 있다", 합침[0].title, "담당차장");
eq("빈 이메일은 채워진 쪽으로", 합침[0].email, "dongh.ko@samsung.com");
eq("출처는 명함첩", 합침[0].src, "card");
eq("합친 줄임을 표시한다", 합침[0].__merged, true);

/* 실제로 보신 화면 — 소속이 다르면 합치지 않습니다 */
const 옛직장 = P({ name: "고동희", company: "시미즈 건설글로벌 프로젝트실 부장",
                   mobile: "010-6294-5086", email: "kodhi@naver.com" });
eq("★ 소속이 다르면 안 합친다", AB.mergeSame([옛직장, 명함]).length, 2);
eq("소속이 다르면 같은 분이 아니다", AB.samePerson(옛직장, 명함), false);

/* 연락처가 하나도 안 겹치면 남입니다 — 동명이인이 같은 회사에 있을 수 있습니다 */
const 갑 = P({ name: "김민수", company: "경기연구원", mobile: "010-1111-1111" });
const 을 = P({ name: "김민수", company: "경기연구원", mobile: "010-2222-2222" });
eq("★ 연락처가 다르면 안 합친다", AB.mergeSame([갑, 을]).length, 2);
const 빈갑 = P({ name: "김민수", company: "경기연구원" });
const 빈을 = P({ name: "김민수", company: "경기연구원" });
eq("★ 둘 다 연락처가 비면 안 합친다", AB.mergeSame([빈갑, 빈을]).length, 2);
eq("이름이 비면 안 합친다", AB.samePerson(P({ mobile: "010-1" }), P({ mobile: "010-1" })), false);
eq("띄어쓰기가 달라도 같은 곳", AB.samePerson(
   P({ name: "고동희", company: "삼성 물산", mobile: "010-6294-5086" }), 명함), true);
eq("빈 목록", AB.mergeSame([]), []);
eq("아무것도 아닌 것", AB.mergeSame(null), []);

/* ── 손으로 지운 줄 ── */
console.log("\n── 손으로 지운 줄 ──");
eq("같은 줄이면 같은 열쇠", AB.rowKey(명함), AB.rowKey({ ...명함 }));
eq("소속이 다르면 다른 열쇠", AB.rowKey(옛직장) === AB.rowKey(명함), false);
eq("띄어쓰기·대소문자는 무시", AB.rowKey(P({ name: "고 동희", company: "삼성물산",
   title: "담당차장", mobile: "010-6294-5086", email: "DongH.Ko@Samsung.com" })),
   AB.rowKey(명함));
const 지움 = new Set([AB.rowKey(옛직장)]);
eq("★ 지운 줄만 빠진다", AB.dropHidden([옛직장, 명함], 지움).map((r) => r.company),
   ["삼성물산"]);
eq("지운 것이 없으면 그대로", AB.dropHidden([옛직장, 명함], new Set()).length, 2);
eq("아무것도 안 넘겨도", AB.dropHidden([옛직장], null).length, 1);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
