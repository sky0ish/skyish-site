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

const NL = String.fromCharCode(10);
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


/* ── 새 갈래 — 동경대(西村中島研究室) · SCSC(돌도끼) · 서울대건축(계획·의장) ──
   「주소록에 <동경대>카테고리를 추가해서 … [SCSC] [서울대건축] 추가해서 돌도끼는 SCSC에
    건축계획연구실과 의장연구실 주소록은 서울대건축에, 西村中島研究室은 [동경대]쪽에」
   여기 이름·연락처는 모두 지어낸 것입니다. 파일의 생김새만 실제와 같습니다. */
console.log("\n── 갈래 단추 ──");
eq("동경대 · SCSC · 서울대건축 갈래가 있다",
   ["alum", "scsc", "snu"].map((k) => AB.GROUP_NAME[k]), ["동경대", "SCSC", "서울대건축"]);
eq("명부 이름", [AB.SRC_NAME.lab, AB.SRC_NAME.scsc, AB.SRC_NAME.snuplan, AB.SRC_NAME.snudesign],
   ["西村中島研究室", "돌도끼", "건축계획연구실", "건축의장연구실"]);

console.log("\n── 옛 명부의 전화 ──");
eq("서울 지역번호 없는 7자리", AB.telOld("595-5891"), "02-595-5891");
eq("서울 지역번호 없는 8자리", AB.telOld("3462 4311"), "02-3462-4311");
eq("지역번호가 있으면 그대로 다듬는다", AB.telOld("031 219 1816"), "031-219-1816");
eq("서울 9자리", AB.telOld("02 880 7052"), "02-880-7052");
eq("휴대폰", AB.telOld(" 010 5472 1083 "), "010-5472-1083");
eq("★ 나라 번호는 적힌 대로", AB.telOld("+39-3298089061"), "+39-3298089061");
eq("★ 미국 번호도 적힌 대로 (전에는 144-3851-7119 로 잘랐습니다)", AB.telOld("1-443-851-7119"), "1-443-851-7119");
eq("내선이 붙은 것은 적힌 대로", AB.telOld("783-7331(512)"), "783-7331(512)");
eq("두 번호를 한 칸에", AB.telOld("1-734-604-9620(US), 010-9027-9620(KOR)"), "1-734-604-9620(US), 010-9027-9620(KOR)");
eq("빈 칸", AB.telOld(""), "");
eq("학번 — 두 자리로", ["95", "0", "1", "OO", "O1", 95, "", "abc"].map(AB.cohort), ["95", "00", "01", "00", "01", "95", "", ""]);

console.log("\n── 돌도끼 (SCSC) ──");
const dol = AB.fromDoldoki([
  { "학번": "95", "이름": "가나다", "전화번호": "010-1111-2222", "이메일": "GA@example.com", "직장": "경기연구원 도시주택연구실" },
  { "학번": 0, "이름": "라마바", "전화번호": "+1-408-728-8113", "이메일": "", "직장": "" },
  { "학번": "이름", "이름": "", "전화번호": "", "이메일": "", "직장": "" },       // 빈 줄
]);
eq("★ SCSC 갈래 · 돌도끼 명부", dol.map((r) => [r.kind, r.src, r.lab]), [["scsc", "scsc", "돌도끼"], ["scsc", "scsc", "돌도끼"]]);
eq("학번은 학부 칸에", dol.map((r) => r.univDept), ["95학번", "00학번"]);
eq("이메일은 소문자로, 직장은 소속으로", [dol[0].email, dol[0].company], ["ga@example.com", "경기연구원 도시주택연구실"]);
eq("해외 번호는 적힌 대로", dol[1].mobile, "+1-408-728-8113");
eq("이름+학번이 사람 열쇠", dol[0].dkey, "scsc|가나다|95");
eq("머리글로 알아본다", AB.looksDoldoki("", ["학번", "이름", "전화번호", "이메일", "직장"]), true);
eq("파일 이름으로도", AB.looksDoldoki("DOlDOKI_주소록_update_중.xlsx", []), true);
eq("경기연구원 명단은 아니다", AB.looksDoldoki("경기연구원_직원명단.xlsx", ["소속", "이름", "직책", "휴대폰"]), false);
/* 파일이 둘 — 같은 사람은 하나로, 더 채워진 쪽으로 */
const two = AB.fromDoldoki([{ "학번": "95", "이름": "가나다", "전화번호": "", "이메일": "", "직장": "" }])
  .concat(dol.slice(0, 1));
eq("★ 두 파일의 같은 사람은 한 줄", AB.dedupePeople(two).length, 1);
eq("채워진 쪽이 남는다", AB.dedupePeople(two)[0].mobile, "010-1111-2222");
/* 새 파일이 이깁니다 — 파일 고친 날(fileAt) */
const older = { ...dol[0], company: "옛 직장", fileAt: "2020-04-23" };
const newer = { ...dol[0], company: "새 직장", fileAt: "2023-06-03" };
eq("★ 파일 고친 날이 늦은 쪽이 남는다", AB.dedupePeople([older, newer])[0].company, "새 직장");

console.log("\n── 西村中島研究室 (동경대) ──");
const nisH = ["", "出身国", "名前", "修了年", "現在の所属", "肩書き", "連絡先（メールアドレス）", "備考欄"];
const nis = AB.fromNishimura([
  { "": 1, "出身国": "韓国", "名前": "南知賢", "修了年": 2011, "現在の所属": "Geonggi Research Institute", "肩書き": "Research Fellow", "連絡先（メールアドレス）": "SKY@example.com", "備考欄": "" },
  { "": 2, "出身国": "", "名前": "宋珍和", "修了年": 2008, "現在の所属": "不明", "肩書き": "不明", "連絡先（メールアドレス）": "不明", "備考欄": "" },
  { "": 3, "出身国": "中国", "名前": "胡宝哲　Hu Baozhe", "修了年": 1993, "現在の所属": "中国城市建设研究院", "肩書き": "教授级高工", "連絡先（メールアドレス）": "hu@example.com", "備考欄": "欠席" },
  { "": 4, "出身国": "台湾", "名前": "（丘先生）", "修了年": "", "現在の所属": "台湾歴史資源経理学会", "肩書き": "秘書長", "連絡先（メールアドレス）": "", "備考欄": "" },
  { "": 5, "出身国": "タイ", "名前": "YONGTANIT PIMONSATHEAN", "修了年": 1994, "現在の所属": "Thammasat University", "肩書き": "Associate Professor", "連絡先（メールアドレス）": "y@example.com", "備考欄": "" },
], nisH);
eq("머리글로 알아본다", AB.looksNishimura(nisH), true);
eq("★ 동경대 갈래 · 西村中島研究室 명부", nis.map((r) => r.kind + "|" + r.src), ["alum|lab", "alum|lab", "alum|lab", "alum|lab", "alum|lab"]);
eq("★ 한국 분은 한글 이름 + 한자", [nis[0].name, nis[0].nameKanji], ["남지현", "南知賢"]);
eq("「不明」 은 빈 칸으로", [nis[1].company, nis[1].title, nis[1].email], ["", "", ""]);
eq("나라는 아래로 이어 받는다", nis.map((r) => r.city), ["한국", "한국", "중국", "대만", "태국"]);
eq("한자 + 로마자는 나눈다", [nis[2].name, nis[2].nameKanji], ["胡宝哲", "Hu Baozhe"]);
eq("괄호는 뗀다", nis[3].name, "丘先生");
eq("로마자 이름은 그대로", nis[4].name, "YONGTANIT PIMONSATHEAN");
eq("수료 해", [nis[0].degreeYear, nis[3].degreeYear], ["2011", ""]);
eq("연구실 · 이메일 소문자 · 비고는 메모", [nis[0].lab, nis[0].email, nis[2].memo], ["西村中島研究室", "sky@example.com", "欠席"]);

console.log("\n── 총동문회 명부의 한글 이름 달기 ──");
const alumRow = { src: "alum", kind: "alum", name: "윤주선", nameKanji: "尹柱善", company: "충남대" };
const labRow = { src: "lab", kind: "alum", name: "尹柱善", nameKanji: "", company: "AURI" };
const linked = AB.linkKanji([alumRow, labRow]);
eq("★ 같은 한자가 총동문회에 있으면 그 한글 이름을", [linked[1].name, linked[1].nameKanji], ["윤주선", "尹柱善"]);
eq("총동문회 줄은 그대로", linked[0].name, "윤주선");
eq("모르는 한자는 그대로", AB.linkKanji([alumRow, { src: "lab", kind: "alum", name: "張松", nameKanji: "Zhang Song" }])[1].name, "張松");
eq("총동문회가 없으면 그대로", AB.linkKanji([labRow])[0].name, "尹柱善");

console.log("\n── 서울대 건축계획연구실 ──");
const planH = ["명부ID", "성명", "학부", "순번(입실 년도)", "석졸", "박사", "구분", "이동통신", "e-mail", "직장명", "직위",
               "우편물발송시", "직장우편", "직장 주소", "직장 전화", "직장 팩스", "자택 우편", "자택 주소", "자택 전화", "우편물 발송지", "석사논문 제목", "박사논문 제목"];
const plan = AB.fromSnuPlan([
  { "명부ID": 1, "성명": "강영건", "학부": 75, "순번(입실 년도)": "80석입/87박입", "석졸": 1985, "박사": 1995, "구분": "박졸",
    "이동통신": "011-389-5891", "e-mail": "KY@example.com", "직장명": "단우건축", "직위": "소장", "직장 주소": "서울시 서초구 방배동 831-7",
    "직장 전화": "595-5891", "자택 주소": "서울시 서초구 방배4동 84-1", "자택 전화": "3333-4444", "석사논문 제목": "", "박사논문 제목": "도시 주거에 관한 연구" },
  { "명부ID": 2, "성명": "김지나", "학부": "OO", "순번(입실 년도)": "05석입", "석졸": "", "박사": "", "구분": "", "이동통신": "", "e-mail": "", "직장명": "(주)삼우종합건축", "직위": "", "직장 전화": "" },
], planH);
eq("머리글로 알아본다", AB.looksSnuPlan(planH), true);
eq("경기연구원 명단은 아니다", AB.looksSnuPlan(["소속", "이름", "직책"]), false);
eq("★ 서울대건축 갈래 · 계획연구실 명부", plan.map((r) => r.kind + "|" + r.src + "|" + r.lab), ["snu|snuplan|건축계획연구실", "snu|snuplan|건축계획연구실"]);
eq("학부 학번", plan.map((r) => r.univDept), ["서울대 건축학과 75학번", "서울대 건축학과 00학번"]);
eq("학위", [plan[0].degree, plan[0].degreeYear, plan[1].degree], ["80석입/87박입 · 박졸", "1995", "05석입"]);
eq("★ 서울 지역번호 없는 직장 전화", plan[0].phone, "02-595-5891");
eq("★ 자택 주소·자택 전화는 안 담는다", [plan[0].addr, JSON.stringify(plan[0]).indexOf("방배4동") < 0, JSON.stringify(plan[0]).indexOf("3333-4444") < 0],
   ["서울시 서초구 방배동 831-7", true, true]);
eq("논문은 메모에", plan[0].memo, "박사논문: 도시 주거에 관한 연구");
eq("소속·직함·이메일", [plan[0].company, plan[0].title, plan[0].email], ["단우건축", "소장", "ky@example.com"]);

console.log("\n── 서울대 건축의장연구실 ──");
/* 실제 파일처럼 위에 제목·교내 전화표가 있고, 머리글은 22번째 줄쯤에 있습니다 */
const grid = [
  [], [], ["", "   건축의장 연구실 2015년 주소록"], ["", "(151-742) 서울특별시 관악구", "tel) 880 7052"], ["", "  교내 전화"],
  ["", "심우갑", 7059, "박홍근", 7050, "과사무실", "", 7051],
  ["", "이름", "", "", "생일", "핸드폰 번호", "자택전화", "직장", "자택 주소", "직장전화", "E-mail address", "출신학교",
   "석사", "석사학위논문", "제출일", "박사", "박사학위논문", "제출일", "간단", "자세히"],
  ["", "김광현 ", "金光鉉", "", "", "010 5472 1083", "02 594 1083", "건축의장연구실", "서울시 서초구 방배3동", "02 880 7052", "kkh@example.com", "", "", "", "", "", "", "", 13, 19],
  [1, "권순정", "權純政", "(박 93)", 601120, "010 3708 7459", "02 2651 7459", "아주대학교 건축학부", "서울시 양천구 목동", "031 219 1816", "sj@example.com",
   "서울대학교 건축학과 동대학원", "", "종합병원 증개축 연구", "1986.2", "1986.2~1999.2", "노인요양시설 연구", "1999.2", 13, 19],
  [2, "가지카와\n아키히로", "梶川\n晶啓", "(박 95) ", "", "", "", "일본거주", "", "", "kaji@example.com", "", "", "", "", "", "", "", 13, 19],
  [3, "홍지학", "洪志學", "(박 07)", "", "+1 857 919 9377\n010 2251 8098", "", "MIT", "", "", " ps@example.com", "", "", "", "", "", "", "", 13, 19],
  [4, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", 13, 19],
];
eq("머리글 줄을 찾는다", AB.snuDesignHeader(grid), 6);
eq("경기연구원 명단(휴대폰·회사전화)은 아니다", AB.looksSnuDesign([["소속", "이름", "직책", "휴대폰", "회사전화", "이메일"]]), false);
const des = AB.fromSnuDesign(grid);
eq("★ 머리글 아래 사람만 — 교내 전화표·빈 줄은 뺀다", des.map((r) => r.name), ["김광현", "권순정", "가지카와 아키히로", "홍지학"]);
eq("★ 서울대건축 갈래 · 의장연구실 명부", [des[0].kind, des[0].src, des[0].lab], ["snu", "snudesign", "건축의장연구실"]);
eq("한자 이름", [des[1].nameKanji, des[2].nameKanji], ["權純政", "梶川晶啓"]);
eq("학위 · 박사 제출 해", [des[1].degree, des[1].degreeYear], ["박 93", "1999"]);
eq("소속 · 직장 전화 · 휴대폰", [des[1].company, des[1].phone, des[1].mobile], ["아주대학교 건축학부", "031-219-1816", "010-3708-7459"]);
eq("출신학교는 학부 칸에, 없으면 서울대 건축학과", [des[1].univDept, des[0].univDept], ["서울대학교 건축학과 동대학원", "서울대 건축학과"]);
eq("논문은 메모에", des[1].memo.split(NL), ["석사논문: 종합병원 증개축 연구", "박사논문: 노인요양시설 연구"]);
eq("★ 생일·자택 전화·자택 주소는 안 담는다", [JSON.stringify(des[1]).indexOf("601120"), JSON.stringify(des[1]).indexOf("2651"), JSON.stringify(des[1]).indexOf("목동")], [-1, -1, -1]);
eq("두 번호를 한 칸에 적은 것은 적힌 대로 (줄바꿈은 띄기로)", des[3].mobile, "+1 857 919 9377 010 2251 8098");
eq("붙은 공백(nbsp)은 뗀다", des[3].email, "ps@example.com");

console.log("\n── 합쳐진 분은 두 갈래 모두에 ──");
const 명함줄 = P({ name: "가나다", company: "경기연구원", title: "연구위원", mobile: "010-1111-2222", kind: "public" });
const 돌도끼줄 = { ...dol[0], company: "경기연구원" };
const 둘 = AB.mergeSame([돌도끼줄, 명함줄]);
eq("★ 한 줄로 합쳐지고", 둘.length, 1);
eq("★ 출처는 명함첩, 다른 갈래는 also 에", [둘[0].kind, 둘[0].also], ["public", ["scsc"]]);
eq("★ 명함 갈래에도, SCSC 갈래에도 든다", [AB.inKind(둘[0], "public"), AB.inKind(둘[0], "scsc"), AB.inKind(둘[0], "all"), AB.inKind(둘[0], "snu")], [true, true, true, false]);
eq("출처 한 줄", [AB.srcLabel(명함줄), AB.srcLabel(dol[0]), AB.srcLabel(nis[0]), AB.srcLabel(des[0])], ["명함첩", "SCSC · 돌도끼", "동경대 · 西村中島研究室", "서울대건축 · 건축의장연구실"]);
eq("딱지 — 갈래 둘 + 명부", (AB.chips(둘[0]).match(/ncat/g) || []).length, 2);
eq("읽은 수 한 줄", AB.readSummary([명함줄, dol[0], dol[1], nis[0], plan[0], des[0]]),
   "명함첩 1명 · 西村中島研究室 1명 · SCSC 돌도끼 2명 · 건축계획연구실 1명 · 건축의장연구실 1명");
eq("빈 것", [AB.inKind(null, "all"), AB.chips(null), AB.readSummary(null), AB.linkKanji(null), AB.fromDoldoki(null), AB.fromNishimura(null, null), AB.fromSnuPlan(null, null), AB.fromSnuDesign(null)],
   [false, "", "", [], [], [], [], []]);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
