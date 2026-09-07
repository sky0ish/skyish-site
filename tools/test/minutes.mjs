// ─── 1.회의록 폴더 읽기 시험 ────────────────────────────────
//
//   돌리는 법 :  node tools/test/minutes.mjs
//
// 진짜 폴더 이름을 그대로 씁니다 (파일은 안 읽습니다).

import { parseFolder, folderDate, pickFiles, titleOf, plan, alreadyHas, pickSlide }
  from "../../assets/js/notes-minutes.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

console.log("\n── 날짜 ──");
eq("맨 앞 여덟 자리", folderDate("20260824_국방연구원"), "2026-08-24");
eq("날짜가 아니면", folderDate("2026007_한국건설기술연구원_김인호_차용운_"), "");
eq("달이 13이면", folderDate("20261324_어디"), "");
eq("빈 것", folderDate(""), "");

console.log("\n── 폴더 이름 뜯기 (진짜 이름들) ──");
const p1 = parseFolder("20260824_국방연구원_남기헌_강소영_심승배");
eq("날짜", p1.date, "2026-08-24");
eq("기관", p1.place, "국방연구원");
eq("만난 사람", p1.people, ["남기헌", "강소영", "심승배"]);

const p2 = parseFolder("20260812_최선영_김소영");
eq("기관 없이 사람만", [p2.place, p2.people], ["", ["최선영", "김소영"]]);

const p3 = parseFolder("20260827_오전_강은호_이선주_박민형_오현웅");
eq("오전을 가려낸다", p3.when, "오전");
eq("오전은 사람이 아니다", p3.people, ["강은호", "이선주", "박민형", "오현웅"]);

const p4 = parseFolder("20260826_한국건설기술연구원");
eq("기관만 있는 날", [p4.place, p4.people], ["한국건설기술연구원", []]);

const p5 = parseFolder("20260831_비스트로미_이소라_김형준_신창");
eq("가게 이름도 기관 자리로", p5.place, "비스트로미");
eq("두 글자 이름도 사람으로", p5.people.includes("신창"), true);

console.log("\n── 폴더 안 파일 고르기 ──");
const FILES = [
  "20260824_국방연구원_남기헌_강소영_심승배.txt",
  "20260824_국방연구원_남기헌_강소영_심승배_회의록.hwpx",
  "20260824_국방연구원_남기헌_강소영_심승배_회의록.pdf",
  "20260824_국방연구원_남기헌_강소영_심승배_회의록내용.json",
  "음성 260824_114513.m4a",
  "자문회의 개최건의(8월24일).pdf",
  "재한 동경대학 총동문회_보고.pdf",
];
const f = pickFiles(FILES);
eq("회의록 PDF 만", f.pdf, "20260824_국방연구원_남기헌_강소영_심승배_회의록.pdf");
/* 개최건의가 목록 앞에 와도 회의록을 집어야 합니다 —
   차례 덕에 지나가던 헛시험을 고쳤습니다 */
eq("개최건의가 먼저 와도 회의록을 집는다",
   pickFiles(["자문회의 개최건의(8월24일).pdf", "가_회의록.pdf"]).pdf, "가_회의록.pdf");
eq("회의록이 아닌 PDF 만 있으면 빈 값",
   pickFiles(["자문회의 개최건의(8월24일).pdf", "보고.pdf"]).pdf, "");
/* 회의록내용 JSON 잣대가 넓어지면 잡히게 */
eq("아무 json 이나 집지 않는다",
   pickFiles(["가_회의록.pdf", "설정.json"]).json, "");
eq("내용 JSON", /_회의록내용\.json$/.test(f.json), true);
eq("txt", /\.txt$/.test(f.txt), true);
eq("녹음은 안 고른다", [f.pdf, f.json, f.txt].some((x) => /\.m4a$/.test(x)), false);
eq("한글 원본도 안 고른다",
   [f.pdf, f.json, f.txt].some((x) => /\.(hwpx|hwx|hox|hbk)$/.test(x)), false);
eq("회의록 PDF 가 없으면", pickFiles(["음성.m4a"]).pdf, "");

console.log("\n── 제목 ──");
eq("JSON 것이 먼저", titleOf(p1, "경기도 방산클러스터 자문"), "경기도 방산클러스터 자문");
eq("없으면 기관과 사람으로", titleOf(p1, ""), "국방연구원 — 남기헌, 강소영, 심승배");
eq("때가 있으면 붙인다", titleOf(p3, ""),
   "강은호, 이선주, 박민형, 오현웅 (오전)");
eq("기관만 있으면", titleOf(p4, ""), "한국건설기술연구원");
eq("아무것도 없으면 폴더 이름", titleOf(parseFolder("20260101"), ""), "20260101");

console.log("\n── 할 일 목록 ──");
const r = plan([
  { name: "20260824_국방연구원_남기헌_강소영_심승배", files: FILES },
  { name: "20260812_최선영_김소영", files: ["20260812_최선영_김소영_회의록.pdf"] },
  { name: "20260831_비스트로미_이소라_김형준_신창",
    files: ["자문회의 개최건의(8월31일)_new.pdf"] },        // 회의록 PDF 가 없습니다
  { name: "2026007_한국건설기술연구원_김인호_차용운_", files: [] },   // 날짜가 아님
  { name: "__pycache__", files: [] },
]);
eq("할 일 둘", r.jobs.map((x) => x.date), ["2026-08-12", "2026-08-24"]);
eq("날짜 차례로", r.jobs[0].date < r.jobs[1].date, true);
eq("건너뛴 것 둘", r.skip.length, 2);
eq("왜 건너뛰는지 적는다",
   r.skip.map((x) => x.why).sort(),
   ["「…_회의록.pdf」 가 없습니다", "이름이 날짜로 시작하지 않습니다"]);
eq("__pycache__ 는 조용히 건너뛴다",
   r.skip.some((x) => x.name === "__pycache__"), false);

console.log("\n── 이미 붙어 있는가 ──");
eq("있으면 참", alreadyHas([{ name: "가.pdf" }], "가.pdf"), true);
eq("없으면 거짓", alreadyHas([{ name: "가.pdf" }], "나.pdf"), false);
eq("붙임이 없으면", alreadyHas(null, "가.pdf"), false);

console.log("\n── 험한 것 ──");
eq("빈 목록", plan([]).jobs, []);
eq("아무것도 아닌 것", plan(null).jobs, []);
eq("이름 없는 줄", plan([{ files: [] }]).jobs, []);

console.log("\n── 발표자료 고르기 ──");
/* 「final 의 발표자료도 올려주고」 */
const SL = ["20260902_회의록.pdf", "자문회의 개최건의(9월2일).pdf",
            "환승역세권과 주거공급_260902_final.pdf",
            "환승역세권과 주거공급_260902_final.pptx", "메모.txt"];
eq("final PDF 를 고른다", pickFiles(SL, "20260902").slide,
   "환승역세권과 주거공급_260902_final.pdf");
eq("회의록은 발표자료가 아니다", pickSlide(["20260902_회의록.pdf"]), "");
eq("개최건의도 아니다", pickSlide(["자문회의 개최건의(9월2일).pdf"]), "");
eq("PDF 가 없으면 pptx 라도", pickSlide(["가_final.pptx", "나.pptx"]), "가_final.pptx");
eq("PDF 가 pptx 보다 먼저", pickSlide(["가.pptx", "나.pdf"]), "나.pdf");
eq("final 이 없으면 먼저 있는 것", pickSlide(["가.pdf", "나.pdf"]), "가.pdf");
eq("최종 이라고 적어도 알아본다", pickSlide(["가.pdf", "나_최종.pdf"]), "나_최종.pdf");
eq("발표자료가 없으면 빈 글자", pickSlide(["20260902_회의록.pdf", "메모.txt"]), "");
eq("아무것도 아닌 것", [pickSlide([]), pickSlide(null)], ["", ""]);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
