// ─── 워크샵 폴더 올리기 시험 ────────────────────────────────
//
//   돌리는 법 :  node tools/test/workshop.mjs
//               (node 가 없으면 _wstest.html 을 로컬 서버로 열어도 같은 시험이 돕니다)
//
// 「워크샵 등의 경우 여기처럼 사진, 회의록이 있는 경우 전부 Schedule 게시판에
//   정보가 올라가게 해줘. 폴더명으로 게시판글 이름으로 해주면되.
//   회의록 아래에 사진이 쭉 붙게 해주면되.」
// 「이렇게 이름/사진 회의록에 들어가면 이름으로 인식해서 주소록에 사진 올려줘」

import { parseFolder, tagFor, roleOf, pickDocs, orderPics, orderMinutes, plan, attachOrder,
         sameTitle, buildBody, personsIn, nameForImage, skipDir }
  from "../../assets/js/notes-workshop.js";
import { parasFromSection, textFromSection, imageRefs, manifest, decodeXml, zipEntries }
  from "../../assets/js/hwpx.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

console.log("\n── 폴더 이름 ──");
const WS = "20260910_[참석] WSCE_World Smart City Expo 2026_Beyond Smart City INto AI City";
const p1 = parseFolder(WS);
eq("날짜", p1.date, "2026-09-10");
eq("유형", p1.kind, "참석");
eq("폴더 이름 그대로 남는다", p1.raw, WS);
eq("괄호 없는 옛 이름", parseFolder("20260908_[참석]_스마트캠퍼스_방위산업생태계 조성전략").kind, "참석");
eq("유형이 없어도 날짜는", parseFolder("20260826_한국건설기술연구원").date, "2026-08-26");
eq("날짜가 아니면", [parseFolder("sample.hwpx").date, parseFolder("20261340_x").date], ["", ""]);
eq("빈 것", parseFolder("").date, "");

console.log("\n── 말머리 ──");
eq("참석 → 세미나참석", tagFor("참석"), "세미나참석");
eq("발표", tagFor("발표"), "발표");
eq("토론", tagFor("토론"), "토론");
eq("워크숍도 세미나참석", tagFor("워크숍"), "세미나참석");
eq("모르면 빈 글자", tagFor("아무거나"), "");

console.log("\n── 파일 갈래 (진짜 폴더의 파일들) ──");
eq("회의록.hwpx", roleOf("회의록.hwpx"), "minutes");
eq("회의록 pdf", roleOf("20260910_회의록_v2.pdf"), "minutes");
eq("회의록 txt 는 글", roleOf("회의록.txt"), "text");
eq("회의록내용.json 은 안 본다", roleOf("가_회의록내용.json"), "skip");
eq("infro(오타)도 행사 정보", roleOf("infro/(국문)WSCE 2026_브로슈어_v.32.pdf"), "info");
eq("intro 도", roleOf("intro/프로그램.pdf"), "info");
eq("Presentation", roleOf("Presentation/발표.pdf"), "slides");
eq("final 폴더도 발표자료", roleOf("final/환승역세권과 주거공급_final.pdf"), "slides");
eq("mid 는 안 올린다", roleOf("mid/환승역세권_v1.pptx"), "skip");
eq("References 도", roleOf("References/논문.pdf"), "skip");
eq("녹음은 안 올린다", roleOf("음성 260902_서민호.m4a"), "skip");
eq("사진", roleOf("KakaoTalk_20260908_195612943.jpg"), "pic");
eq("사진 폴더의 사진", roleOf("pictures/a.jpg"), "pic");
eq("개최개요 그림은 행사 정보", roleOf("개최개요.jpg"), "info");
eq("바닥의 발표 PDF 는 발표자료", roleOf("남지현_경기도 역세권 복합개발_260902.pdf"), "slides");
eq("hwp 자료는 자료", roleOf("정책제언 양식.hwp"), "doc");
eq("임시본은 안 본다", roleOf("~$회의록.hwpx"), "skip");
eq("Thumbs.db", roleOf("pictures/Thumbs.db"), "skip");
eq("건너뛰는 폴더", [skipDir("References"), skipDir("mid"), skipDir("infro")], [true, true, false]);

console.log("\n── 짝 고르기 ──");
eq("pptx·pdf 짝이면 PDF 만", pickDocs(["a/발표.pptx", "a/발표.pdf"]), ["a/발표.pdf"]);
eq("PDF 가 없으면 pptx 라도", pickDocs(["a/발표.pptx"]), ["a/발표.pptx"]);
eq("final 이 앞으로", pickDocs(["a/초안.pdf", "a/발표_final.pdf"]), ["a/발표_final.pdf", "a/초안.pdf"]);
eq("사진은 바닥 → 사진 폴더 → 나머지, 숫자 차례",
   orderPics(["pictures/b10.jpg", "pictures/b2.jpg", "x.jpg", "Presentation/캡처.png"]),
   ["x.jpg", "pictures/b2.jpg", "pictures/b10.jpg", "Presentation/캡처.png"]);
eq("회의록은 새 판 먼저, PDF 먼저",
   orderMinutes(["가_회의록.hwpx", "가_회의록_v2.hwpx", "가_회의록_v2.pdf", "가_회의록.pdf"]),
   ["가_회의록_v2.pdf", "가_회의록_v2.hwpx", "가_회의록.pdf", "가_회의록.hwpx"]);
eq("★ 보강한 v1 이 현장 원본보다 앞에", orderMinutes(["회의록.hwpx", "회의록_v1.hwpx"]),
   ["회의록_v1.hwpx", "회의록.hwpx"]);

console.log("\n── 할 일 목록 ──");
const r = plan([
  { name: WS, files: [
    { path: "회의록.hwpx" }, { path: "infro/(Eng.)WSCE 2026_Conference Book_v15..pdf" },
    { path: "infro/(국문)WSCE 2026_브로슈어_v.32.pdf" }, { path: "Presentation/발표.pdf" },
    { path: "Presentation/발표.pptx" }, { path: "사진/IMG_2.jpg" }, { path: "사진/IMG_1.jpg" },
    { path: "음성.m4a" } ] },
  { name: "20260908_[참석]_스마트캠퍼스_방위산업생태계 조성전략", files: [
    "[PPT] 260907_경기도 피지컬 AI 방위산업 생태계 조성전략_final.pdf",
    "[발표] 260907_경기도 피지컬 AI 방위산업 생태계 조성전략.pptx" ] },
  { name: "sample.hwpx", files: [] },
  { name: "20260101_빈폴더", files: ["녹음.m4a"] },
  { name: "__pycache__", files: [] },
]);
eq("두 건", r.jobs.map((j) => j.date), ["2026-09-08", "2026-09-10"]);
const j = r.jobs[1];
eq("★ 제목은 폴더 이름 그대로", j.title, WS);
eq("말머리", j.tag, "세미나참석");
eq("회의록", j.minutes, ["회의록.hwpx"]);
eq("행사 정보 둘", j.info.length, 2);
eq("발표자료는 PDF 만", j.slides, ["Presentation/발표.pdf"]);
eq("사진은 이름 차례", j.pics, ["사진/IMG_1.jpg", "사진/IMG_2.jpg"]);
eq("★ 붙임 차례 — 회의록 → 정보 → 발표 → 사진",
   attachOrder(j).map((p) => p.split("/")[0]),
   ["회의록.hwpx", "infro", "infro", "Presentation", "사진", "사진"]);
eq("★ 이름이 달라도 PDF 가 있으면 발표자료는 PDF 만", r.jobs[0].slides,
   ["[PPT] 260907_경기도 피지컬 AI 방위산업 생태계 조성전략_final.pdf"]);
eq("행사 정보는 같은 이름 짝만 거른다", pickDocs(["a/안내.pptx", "a/공문.pdf"]).length, 2);
eq("건너뛴 것과 까닭", r.skip.map((x) => x.why),
   ["이름이 날짜로 시작하지 않습니다", "붙일 회의록·자료·사진이 없습니다"]);
eq("__pycache__ 는 조용히", r.skip.some((x) => x.name === "__pycache__"), false);
eq("험한 것", [plan(null).jobs, plan([{ files: [] }]).jobs], [[], []]);

console.log("\n── 글 ──");
eq("같은 제목 — 빈칸·대소문자 무시", sameTitle("20260910_[참석]  WSCE", "20260910_[참석] wsce"), true);
eq("다른 제목", sameTitle("가", "나"), false);
eq("빈 제목은 같지 않다", sameTitle("", ""), false);
const body = buildBody(j, "1.부산 센텀\n주거, 마이스");
eq("본문 머리에 자료 폴더", body.split("\n")[0], "자료: " + WS);
eq("역할", body.split("\n")[1], "역할: 참석");
eq("회의록 글이 이어진다", /1\.부산 센텀\n주거, 마이스$/.test(body), true);
eq("길면 자르고 알린다", /회의록 파일에 이어집니다/.test(buildBody(j, "가나다 ".repeat(100), 50)), true);
eq("글이 없으면 머리만", buildBody(j, "").split("\n").length, 2);

console.log("\n── 회의록 안 얼굴 사진 → 그 사람 ──");
const L = "국토교통과학기술진흥원(카이야.)  국토교통과학기술진흥원 김기욱 센터장";
eq("이름과 소속", personsIn(L), [{ name: "김기욱", org: "국토교통과학기술진흥원", title: "센터장" }]);
eq("본부장(메일)", personsIn("성남산업진흥원 이덕희 본부장(doc3018@gmail.com)")[0],
   { name: "이덕희", org: "성남산업진흥원", title: "본부장" });
eq("괄호 소속", personsIn("이석준(이천시청)")[0], { name: "이석준", org: "이천시청", title: "" });
eq("사람이 없으면", personsIn("규제샌드박스 적용예시"), []);
eq("★ 「가능(4+2년)」 은 사람이 아니다", personsIn("최장 특례기간 가능(4+2년)"), []);
eq("이름만 적혀 있으면 안 본다", personsIn("김기욱"), []);
eq("주소록에 있는 이름이면 이름만 있어도", personsIn("김기욱", new Set(["김기욱"])),
   [{ name: "김기욱", org: "", title: "" }]);
const PARAS = [
  { text: "3. 성남형 라이프 모빌리티", images: [] },
  { text: "성남산업진흥원 이덕희 본부장(doc3018@gmail.com)", images: [] },
  { text: "4. 스마트도시 규제샌드박스", images: [] },
  { text: L, images: [] },
  { text: "타 법률의 제약사항을 푸는 규제 샌드박스", images: [] },
  { text: "규제샌드박스 적용예시", images: ["image1"] },
  { text: "신청요건", images: [] },
  { text: "", images: ["image2"] },
  { text: "최장 특례기간 가능(4+2년)", images: ["image3"] },
  { text: "한국건설기술연구원 김인호 박사", images: [] },
];
eq("괄호 낱말은 건너뛰고 앞의 진짜 사람", nameForImage(PARAS, "image3").name, "김기욱");
eq("★ 사진 앞에 가장 가까이 적힌 사람", nameForImage(PARAS, "image1").name, "김기욱");
eq("멀리 있어도 앞의 마지막 사람", nameForImage(PARAS, "image2").name, "김기욱");
eq("소속도 함께", nameForImage(PARAS, "image2").org, "국토교통과학기술진흥원");
eq("앞에 아무도 없으면 바로 뒤에서",
   nameForImage([{ text: "", images: ["a"] }, { text: "홍길동 교수", images: [] }], "a").name, "홍길동");
eq("아무도 없으면 null", nameForImage([{ text: "", images: ["a"] }], "a"), null);
eq("없는 그림", nameForImage(PARAS, "없음"), null);
eq("험한 것", [nameForImage(null, "a"), nameForImage([], "a")], [null, null]);

console.log("\n── hwpx XML ──");
const XML =
  '<hs:sec><hp:p id="1"><hp:run><hp:secPr/></hp:run><hp:run><hp:t/></hp:run></hp:p>' +
  '<hp:p id="2"><hp:run><hp:t>1.부산 &lt;센텀&gt; &amp; AX</hp:t></hp:run></hp:p>' +
  '<hp:p id="3"><hp:run/></hp:p><hp:p id="4"><hp:run/></hp:p>' +
  '<hp:p id="5"><hp:run><hp:t>둘째<hp:lineBreak/>줄</hp:t></hp:run></hp:p>' +
  '<hp:p id="6"><hp:run><hp:t>그림</hp:t><hp:pic><hc:img binaryItemIDRef="image1" bright="0"/></hp:pic></hp:run></hp:p>' +
  '<hp:p id="7"><hp:run><hp:pic><hc:img bright="0" binaryItemIDRef="image2"/></hp:pic></hp:run></hp:p></hs:sec>';
eq("글만, 빈 문단은 하나로", textFromSection(XML), "1.부산 <센텀> & AX\n\n둘째\n줄\n그림");
const PS = parasFromSection(XML);
eq("문단마다 그림 id", PS.map((p) => p.images), [[], [], [], [], [], ["image1"], ["image2"]]);
eq("그림 차례", imageRefs(XML), ["image1", "image2"]);
eq("엔티티", decodeXml("&lt;a&gt; &amp; &#44032; &#xAC00;"), "<a> & 가 가");
const HPF = '<opf:package><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>' +
  '<opf:item id="image1" href="BinData/image1.bmp" media-type="image/bmp" isEmbeded="1"/>' +
  '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/></opf:manifest>' +
  '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>';
const MF = manifest(HPF);
eq("그림 목록", MF.items.image1, { href: "BinData/image1.bmp", type: "image/bmp" });
eq("차례", MF.spine, ["header", "section0"]);
/* 손으로 만든 작은 zip (stored) — 「a.txt」 = "hi" */
const Z = new Uint8Array([
  0x50,0x4b,0x03,0x04, 10,0, 0,0, 0,0, 0,0,0,0, 0,0,0,0, 2,0,0,0, 2,0,0,0, 5,0, 0,0,
  0x61,0x2e,0x74,0x78,0x74, 0x68,0x69,
  0x50,0x4b,0x01,0x02, 20,0, 10,0, 0,0, 0,0, 0,0,0,0, 0,0,0,0, 2,0,0,0, 2,0,0,0, 5,0, 0,0, 0,0, 0,0, 0,0, 0,0,0,0, 0,0,0,0,
  0x61,0x2e,0x74,0x78,0x74,
  0x50,0x4b,0x05,0x06, 0,0, 0,0, 1,0, 1,0, 51,0,0,0, 37,0,0,0, 0,0,
]);
const ZE = zipEntries(Z);
eq("zip 목록", [...ZE.keys()], ["a.txt"]);
eq("zip 크기·방식", [ZE.get("a.txt").usize, ZE.get("a.txt").method], [2, 0]);
let threw = "";
try { zipEntries(new Uint8Array(10)); } catch (e) { threw = e.message; }
eq("zip 이 아니면 알린다", /zip/.test(threw), true);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
globalThis.__testBad = bad;
if (typeof process !== "undefined" && process.exit) process.exit(bad ? 1 : 0);
