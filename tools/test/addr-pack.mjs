// ─── 얼굴 사진 꾸러미 시험 ──────────────────────────────────
//
//   돌리는 법 :  node tools/test/addr-pack.mjs
//
// 컴퓨터에서 넣어 둔 얼굴이 폰 앱에서는 안 보이던 것 —
// 사진이 내 컴퓨터 폴더와 그 브라우저 안에만 있어서였습니다.
// 한 파일로 묶어 옮기는 길을 지키기 위한 시험입니다.

import { IMG_EXT, photoKey, nameFromFile, isPack, packFileName,
         packText, readPack, dataUrlType, sortPicked,
         orgKey, personKey, splitFileName, findKey, isSharedKey, readExtras, EXTRA_FIELDS,
         candidateKeys, faceFileStem, atDate }
  from "../../assets/js/addr-pack.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};
const D = (s) => "data:image/jpeg;base64," + Buffer.from(s).toString("base64");

console.log("\n── 파일 이름에서 사람 이름만 ──");
/* 9.FACE 에 「이름_소속.jpg」 로 저장하는 규칙을 그대로 따라야 합니다 */
eq("이름만", nameFromFile("이석준.jpg"), "이석준");
eq("이름_소속", nameFromFile("김형준_ASSETTA.jpg"), "김형준");
eq("괄호 소속", nameFromFile("윤혜영 (인천연구원).png"), "윤혜영");
eq("폴더가 앞에 붙어도", nameFromFile("9.FACE/조장석_경기도청.jpeg"), "조장석");
eq("윈도우 경로도", nameFromFile("C:\\face\\현병천.webp"), "현병천");
eq("확장자 대문자", nameFromFile("이소라.JPG"), "이소라");
eq("그림이 아니면 이름을 안 깎는다", nameFromFile("메모.txt"), "메모.txt");
eq("빈 것", [nameFromFile(""), nameFromFile(null)], ["", ""]);

console.log("\n── 이름 열쇠 ──");
eq("띄어쓰기를 뺀다", photoKey("이 석준"), "이석준");
eq("영문은 소문자로", photoKey("Kim HyungJun"), "kimhyungjun");
eq("같은 사람으로 묶인다",
   photoKey(nameFromFile("김형준_ASSETTA.jpg")) === photoKey("김 형준"), true);

console.log("\n── 그림 확장자 ──");
eq("그림들", ["a.jpg", "a.jpeg", "a.png", "a.webp", "a.gif", "a.avif"].map((n) => IMG_EXT.test(n)),
   [true, true, true, true, true, true]);
eq("그림이 아닌 것", ["a.txt", "a.pdf", "a.json", "a"].map((n) => IMG_EXT.test(n)),
   [false, false, false, false]);

console.log("\n── 꾸러미 이름 ──");
eq("날짜를 붙인다", packFileName("20260907"), "얼굴사진_20260907.json");
eq("점이 섞여도", packFileName("2026-09-07"), "얼굴사진_20260907.json");
eq("날짜가 없으면", packFileName(""), "얼굴사진.json");
eq("꾸러미인지 알아본다",
   [isPack("얼굴사진_20260907.json"), isPack("이석준.jpg"), isPack("")],
   [true, false, false]);

console.log("\n── 묶고 풀기 ──");
const items = [
  { key: "이석준", data: D("가짜그림1") },
  { key: "김 형준", data: D("가짜그림2") },
];
const text = packText(items);
eq("몇 장인지 적어 둔다", JSON.parse(text).n, 2);
eq("무엇인지 적어 둔다", JSON.parse(text).what, "skyish-얼굴사진");
const back = readPack(text);
eq("두 장이 돌아온다", back.length, 2);
eq("열쇠로 담긴다", back.map((x) => x.key).sort(), ["김형준", "이석준"]);
eq("그림이 그대로다", back.find((x) => x.key === "이석준").data, D("가짜그림1"));

console.log("\n── 이상한 것은 담지도 풀지도 않습니다 ──");
/* 남이 준 파일이 섞여 들어와도 그림이 아닌 것은 브라우저에 담기지 않게. */
eq("그림이 아닌 값은 안 담는다",
   JSON.parse(packText([{ key: "누구", data: "javascript:alert(1)" }])).n, 0);
eq("data: 가 아닌 주소도 안 담는다",
   JSON.parse(packText([{ key: "누구", data: "https://example.com/a.jpg" }])).n, 0);
eq("이름이 없으면 안 담는다", JSON.parse(packText([{ key: "  ", data: D("x") }])).n, 0);
eq("아무것도 아닌 것", [JSON.parse(packText(null)).n, JSON.parse(packText([null])).n], [0, 0]);

eq("글이 아니면 빈 목록", [readPack("").length, readPack("{").length, readPack(null).length],
   [0, 0, 0]);
eq("photos 가 없으면 빈 목록", readPack('{"v":1}').length, 0);
eq("그림이 아닌 값은 풀지 않는다",
   readPack('{"photos":{"누구":"javascript:alert(1)","이석준":"' + D("ok") + '"}}')
     .map((x) => x.key), ["이석준"]);
eq("data: 텍스트도 풀지 않는다",
   readPack('{"photos":{"누구":"data:text/html;base64,PHNjcmlwdD4="}}').length, 0);

console.log("\n── 그림 갈래 ──");
eq("jpeg", dataUrlType(D("x")), "image/jpeg");
eq("png", dataUrlType("data:image/png;base64,AAA"), "image/png");
eq("그림이 아니면 빈 글자", dataUrlType("data:text/plain;base64,AAA"), "");

console.log("\n── 고른 파일 나누기 ──");
eq("꾸러미·그림·나머지",
   sortPicked(["얼굴사진_20260907.json", "이석준.jpg", "김형준_ASSETTA.PNG", "메모.txt"]),
   { packs: ["얼굴사진_20260907.json"], imgs: ["이석준.jpg", "김형준_ASSETTA.PNG"],
     other: ["메모.txt"] });
eq("빈 것", sortPicked(null), { packs: [], imgs: [], other: [] });

console.log("\n── 동명이인 ──");
/* 실제로 있었던 일: 「NT로봇 대표 김경환」 의 얼굴이 「경기도청 김경환」 께
   붙었습니다. 사진을 이름만으로 짝지었기 때문입니다. */
eq("소속을 다듬는다", [orgKey("NT 로봇(주)"), orgKey("NT로봇"), orgKey("경기도청")],
   ["nt로봇", "nt로봇", "경기도청"]);
eq("주식회사·㈜ 를 뗀다", [orgKey("한국환경연구원 주식회사"), orgKey("㈜한국환경연구원")],
   ["한국환경연구원", "한국환경연구원"]);
eq("Inc·Ltd 도", [orgKey("ASSETTA Inc."), orgKey("ASSETTA")], ["assetta", "assetta"]);
eq("소속이 없으면 이름만", personKey("이석준", ""), "이석준");
eq("소속이 있으면 함께", personKey("김경환", "NT로봇"), "김경환|nt로봇");
eq("이름이 없으면 빈 글자", personKey("", "NT로봇"), "");
eq("같은 이름 다른 소속은 다른 열쇠",
   personKey("김경환", "NT로봇") !== personKey("김경환", "경기도청"), true);

console.log("\n── 파일 이름을 이름과 소속으로 ──");
eq("이름_소속", splitFileName("김경환_NT로봇.jpg"), { name: "김경환", org: "NT로봇" });
eq("괄호 소속", splitFileName("윤혜영 (인천연구원).png"), { name: "윤혜영", org: "인천연구원" });
eq("소속이 없으면", splitFileName("이석준.jpg"), { name: "이석준", org: "" });
eq("폴더가 앞에 붙어도", splitFileName("9.FACE/조장석_경기도청.jpeg"),
   { name: "조장석", org: "경기도청" });
eq("윈도우 경로도", splitFileName("C:\\face\\현병천_경기도청.webp"),
   { name: "현병천", org: "경기도청" });
eq("소속이 여럿이면 첫 번째만", splitFileName("남지현_경기연구원_도시본부.jpg"),
   { name: "남지현", org: "경기연구원" });
/* 윈도우·구글 드라이브가 붙이는 중복 표시 — 소속으로 읽으면 아무에게도 안 붙습니다 */
eq("(1) 은 소속이 아니다", splitFileName("이석준 (1).jpg"), { name: "이석준", org: "" });
eq("(2) 도", splitFileName("김경환_NT로봇 (2).png"), { name: "김경환", org: "NT로봇" });
eq("괄호 안이 글자면 소속으로 본다", splitFileName("윤혜영(인천연구원).jpg"),
   { name: "윤혜영", org: "인천연구원" });

console.log("\n── 누구의 사진인가 ──");
const K = new Set([personKey("김경환", "NT로봇"), personKey("이석준", "")]);
eq("소속까지 맞으면 붙는다", findKey(K, "김경환", "NT로봇"), "김경환|nt로봇");
/* ★ 이번 사고 — 주소록에 김경환 이 둘 있으니(twin=true) 소속이 맞아야만 붙습니다 */
eq("소속이 다르면 안 붙는다", findKey(K, "김경환", "경기도청", true), "");
eq("소속을 모르면 안 붙는다", findKey(K, "김경환", "", true), "");
eq("소속 없이 담긴 옛 사진은 누구에게나", findKey(K, "이석준", "경기연구원"), "이석준");
eq("없는 사람", findKey(K, "홍길동", "어디"), "");
eq("이름이 비면", findKey(K, "", "NT로봇"), "");
eq("배열로 물어도 된다",
   findKey([personKey("김경환", "NT로봇")], "김경환", "NT 로봇(주)"), "김경환|nt로봇");
eq("나눠 쓰는 열쇠인지 안다",
   [isSharedKey("이석준"), isSharedKey("김경환|nt로봇"), isSharedKey("")],
   [true, false, false]);

console.log("\n── 명함 받아 채워 넣은 내용 ──");
const ex = new Map([
  ["김경환|nt로봇", { title: "대표이사", memo: "로봇신문 인터뷰", at: 1 }],
  ["빈사람", { title: "  " }],
]);
const t2 = packText([{ key: "김경환|nt로봇", data: D("얼굴") }], ex);
eq("꾸러미가 둘을 함께 담는다", [JSON.parse(t2).n, JSON.parse(t2).nExtra], [1, 1]);
eq("빈 값만 있으면 안 담는다", JSON.parse(t2).extra["빈사람"], undefined);
const back2 = readExtras(t2);
eq("한 사람이 돌아온다", back2.length, 1);
eq("칸이 그대로", back2[0].data, { title: "대표이사", memo: "로봇신문 인터뷰" });
eq("at 같은 것은 안 실린다", back2[0].data.at, undefined);
eq("모르는 칸은 버린다",
   readExtras('{"extra":{"누구":{"title":"대표","몰래":"나쁜값"}}}')[0].data,
   { title: "대표" });
eq("extra 가 없으면 빈 목록", readExtras('{"photos":{}}').length, 0);
eq("글이 아니면 빈 목록", readExtras("{").length, 0);
eq("담을 수 있는 칸", EXTRA_FIELDS.includes("memo") && EXTRA_FIELDS.includes("mobile"), true);
eq("사진만 있어도 된다", JSON.parse(packText([{ key: "누구", data: D("x") }])).nExtra, 0);

console.log("\n── 동명이인이 있을 때만 깐깐하게 ──");
/* 9.FACE 에는 「김고은_부연구위원.jpg」 처럼 밑줄 뒤가 소속이 아니라 직함인
   파일이 많습니다. 이름이 하나뿐이면 그런 것도 붙어야 합니다 —
   안 그러면 여태 잘 붙던 얼굴이 몽땅 사라집니다. */
const K2 = new Set(["김경환|nt로봇", "김고은|부연구위원", "이석준"]);
eq("혼자면 직함 꼬리도 붙는다", findKey(K2, "김고은", "경기연구원", false), "김고은|부연구위원");
eq("혼자면 소속 없는 것도 붙는다", findKey(K2, "이석준", "어디든", false), "이석준");
eq("동명이인이면 소속이 맞아야만", findKey(K2, "김경환", "NT로봇", true), "김경환|nt로봇");
eq("동명이인이고 소속이 다르면 안 붙는다", findKey(K2, "김경환", "경기도청", true), "");
eq("동명이인이면 소속 없는 옛 사진도 안 붙는다",
   findKey(new Set(["이석준"]), "이석준", "경기연구원", true), "");
eq("같은 이름 후보가 둘이면 고르지 않는다",
   findKey(new Set(["김경환|nt로봇", "김경환|경기도청"]), "김경환", "어디", false), "");
eq("후보를 알려 준다",
   candidateKeys(new Set(["김경환|nt로봇", "김경환", "이석준"]), "김경환").sort(),
   ["김경환", "김경환|nt로봇"]);
eq("후보가 없으면 빈 목록", candidateKeys(new Set(["이석준"]), "홍길동"), []);

console.log("\n── 파일 이름 왕복 ──");
/* 폴더에 되돌려 저장한 이름을 다시 읽었을 때 같은 사람이어야 합니다 */
const safeName = (t) => String(t).replace(/[\/:*?"<>|]/g, " ");
const roundTrip = (name, org) => {
  const fname = faceFileStem(name, org, safeName) + ".jpg";
  const back = splitFileName(fname);
  return personKey(back.name, back.org) === personKey(name, org);
};
eq("괄호 딸린 회사도 돌아온다", roundTrip("김경환", "NT로봇(주)"), true);
eq("㈜ 가 앞에 붙어도", roundTrip("김경환", "(주)NT로봇"), true);
eq("빗금이 든 회사도", roundTrip("홍길동", "삼성/전자"), true);
eq("소속이 없어도", roundTrip("이석준", ""), true);
eq("밑줄이 든 회사도", roundTrip("아무개", "가_나 연구원"), true);

console.log("\n── SVG 는 사진이 아닙니다 ──");
/* 그림처럼 보이지만 스크립트를 품을 수 있는 문서입니다.
   blob 주소로 만들면 이 홈페이지 출처의 문서가 되어 버립니다. */
const SVG = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
eq("안 담긴다", JSON.parse(packText([{ key: "누구", data: SVG }])).n, 0);
eq("안 풀린다", readPack(JSON.stringify({ photos: { 누구: SVG } })).length, 0);
eq("보통 그림은 그대로", readPack(JSON.stringify({ photos: { 누구: D("ok") } })).length, 1);

console.log("\n── 명함 등록일을 날짜로 ──");
/* 「리멤버 명함집에서 들어오는 정보들은 언제 명함을 등록했는지 나와있어..
    그날의 스케쥴을 칼렌다에서 불러와서 그 밑에 적어주면
    언제 무슨 모임에서 만났는지 알수있어」 */
eq("리멤버 꼴", atDate("2021년 01월 29일"), "2021-01-29");
eq("한 자리 달·날도", atDate("2026년 9월 8일"), "2026-09-08");
eq("뒤에 시각이 붙어도", atDate("2021년 1월 29일 오전 10:12"), "2021-01-29");
eq("줄표·점·빗금", [atDate("2026-09-08"), atDate("2026.9.8"), atDate("2026/09/08")],
   ["2026-09-08", "2026-09-08", "2026-09-08"]);
eq("여덟 자리", atDate("20260908"), "2026-09-08");
eq("앞뒤 빈칸", atDate("  2026-09-08  "), "2026-09-08");
eq("날짜가 아니면 빈 글자",
   [atDate(""), atDate(null), atDate("아무거나"), atDate("2026")], ["", "", "", ""]);
/* 있지도 않은 날짜로 게시판에 묻지 않게 */
eq("달이 13이면", atDate("2026년 13월 1일"), "");
eq("날이 0이거나 32면", [atDate("2026-09-00"), atDate("2026-09-32")], ["", ""]);
eq("해가 너무 옛날이면", atDate("1899-01-01"), "");
eq("여덟 자리인 척하는 전화번호", atDate("01012345678"), "");

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
