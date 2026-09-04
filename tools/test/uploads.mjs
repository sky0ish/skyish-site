// ─── 올린 자료 모아 보기 시험 ───────────────────────────────
//
//   돌리는 법 :  node tools/test/uploads.mjs

import { fileRows, pickFiles, matchFile, counts, summary, groupOf, duplicates, byBoard }
  from "../../assets/js/notes-uploads.js";

/* 자료는 Schedule·회의록·일상 등 여러 게시판에서 올라옵니다 */
const CAT_NAME = {
  schedule: "Schedule", diary: "Diary", minutes: "회의록",
  daily: "일상", etc: "ETC",
};

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

const ROWS = [
  { id: "a", title: "국토도시계획학회 발표", category: "schedule", tag: "",
    event_date: "2026-09-02", place: "서울역 공항철도회의실", event: "복합환승센터 세미나",
    people: "서민호, 김고은",
    files: [
      { name: "개최개요.jpg", path: "notes/1_a.jpg", type: "image", size: 388000 },
      { name: "발표자료.pdf", path: "notes/2_b.pdf", type: "pdf",   size: 2400000 },
    ] },
  { id: "b", title: "방산클러스터 자문회의", category: "minutes", tag: "회의",
    event_date: "2026-08-30", place: "경기연구원", event: "", people: "이석준",
    files: [
      { name: "명단.xlsx", path: "notes/3_c.xlsx", type: "excel", size: 12000 },
      { name: "메모.txt",  path: "notes/4_d.txt",  type: "text",  size: 900 },
    ] },
  { id: "c", title: "붙임 없는 글", category: "daily", event_date: "2026-09-01", files: null },
  { id: "d", title: "같은 파일이 또", category: "etc", event_date: "",
    files: [{ name: "개최개요.jpg", path: "notes/1_a.jpg", type: "image", size: 388000 }] },
];

/* 한 글에 같은 파일이 두 번 적힌 것 · 날짜가 created_at 뿐인 것 */
const ODD = [
  { id: "e", title: "두 번 적힌 글", category: "daily", event_date: "2026-07-07",
    files: [
      { name: "같은것.pdf", path: "notes/9_z.pdf", type: "pdf", size: 100 },
      { name: "같은것.pdf", path: "notes/9_z.pdf", type: "pdf", size: 100 },
    ] },
  { id: "f", title: "날짜가 없는 글", category: "etc",
    created_at: "2026-05-05T09:00:00+09:00",
    files: [{ name: "CamelCase.PDF", path: "notes/8_y.pdf", type: "pdf", size: 2048 }] },
];

console.log("\n── 파일 목록으로 펴기 ──");
const items = fileRows(ROWS, CAT_NAME);
eq("붙임이 있는 것만 센다", items.length, 5);
eq("붙임 없는 글은 빠진다", items.some((x) => x.postId === "c"), false);
eq("새것부터 온다", items.map((x) => x.date),
   ["2026-09-02", "2026-09-02", "2026-08-30", "2026-08-30", ""]);
eq("날짜 없는 것은 맨 뒤", items[items.length - 1].postId, "d");
eq("글 제목을 달고 온다", items[0].postTitle, "국토도시계획학회 발표");

console.log("\n── 종류 묶기 ──");
eq("그림", groupOf("image"), "image");
eq("PDF", groupOf("pdf"), "pdf");
eq("엑셀도 CSV도 표", [groupOf("excel"), groupOf("csv")], ["sheet", "sheet"]);
eq("나머지는 문서", [groupOf("text"), groupOf("file"), groupOf(undefined)],
   ["doc", "doc", "doc"]);
eq("묶음마다 셈", counts(items), { all: 5, image: 2, pdf: 1, sheet: 1, doc: 1 });

console.log("\n── 거르기 ──");
eq("PDF 만", pickFiles(items, "pdf", "").map((x) => x.name), ["발표자료.pdf"]);
eq("전체는 다", pickFiles(items, "all", "").length, 5);
eq("파일 이름으로 찾기", pickFiles(items, "all", "명단").map((x) => x.name), ["명단.xlsx"]);
eq("글 제목으로 찾기", pickFiles(items, "all", "방산").map((x) => x.name).sort(),
   ["memo".replace("memo", "메모.txt"), "명단.xlsx"]);
eq("장소로 찾기", pickFiles(items, "all", "서울역").length, 2);
eq("만난 사람으로 찾기", pickFiles(items, "all", "이석준").length, 2);
eq("낱말을 모두 품어야", pickFiles(items, "all", "방산 명단").map((x) => x.name), ["명단.xlsx"]);
eq("없는 말", pickFiles(items, "all", "없는말").length, 0);
eq("묶음과 찾기를 함께", pickFiles(items, "image", "개최").length, 2);

console.log("\n── 여러 게시판에서 올라옵니다 ──");
eq("어디서 온 것인지 달고 온다",
   items.map((x) => x.catLabel),
   ["Schedule", "Schedule", "회의록", "회의록", "ETC"]);
eq("게시판마다 셈 (많은 곳부터)",
   byBoard(items).map((b) => [b.label, b.n]),
   [["Schedule", 2], ["회의록", 2], ["ETC", 1]]);
eq("회의록 것만", pickFiles(items, "all", "", "minutes").map((x) => x.name).sort(),
   ["메모.txt", "명단.xlsx"]);
eq("Schedule 의 PDF 만",
   pickFiles(items, "pdf", "", "schedule").map((x) => x.name), ["발표자료.pdf"]);
eq("게시판 이름으로도 찾힌다", pickFiles(items, "all", "회의록").length, 2);
eq("게시판을 안 고르면 다", pickFiles(items, "all", "", "all").length, 5);
eq("이름표가 없으면 갈래값을 그대로",
   fileRows([{ id: "z", category: "minutes", files: [{ path: "p", name: "n" }] }])[0].catLabel,
   "minutes");

console.log("\n── 한 글에 같은 파일이 두 번 ──");
const odd = fileRows(ODD, CAT_NAME);
eq("한 번만 센다", odd.filter((x) => x.postId === "e").length, 1);

console.log("\n── event_date 가 없으면 created_at ──");
eq("created_at 의 날짜를 쓴다", odd.find((x) => x.postId === "f").date, "2026-05-05");
eq("새것부터 차례", odd.map((x) => x.date), ["2026-07-07", "2026-05-05"]);

console.log("\n── 대소문자를 가리지 않는다 ──");
eq("소문자로 찾아도", pickFiles(odd, "all", "camelcase").length, 1);
eq("대문자로 찾아도", pickFiles(odd, "all", "CAMELCASE").length, 1);
eq("확장자도", pickFiles(odd, "all", ".pdf").length, 2);

console.log("\n── 알림말 ──");
eq("셈과 크기", summary(pickFiles(items, "pdf", "")), "자료 1개 · 모두 2.3MB");
eq("빈 것", summary([]), "자료 0개");
eq("여러 개면 크기를 더한다", summary(items), "자료 5개 · 모두 3.0MB");
eq("크기를 모르면 셈만", summary([{ size: 0 }, { size: 0 }]), "자료 2개");

console.log("\n── 같은 파일이 여러 글에 ──");
const dup = duplicates(items);
eq("한 벌이 겹친다", dup.length, 1);
eq("두 글에 붙어 있다", dup[0].map((x) => x.postId).sort(), ["a", "d"]);

console.log("\n── 험한 입력에도 견딘다 ──");
eq("빈 목록", fileRows([]).length, 0);
eq("아무것도 아닌 것", fileRows(null).length, 0);
eq("files 가 배열이 아니면", fileRows([{ id: "x", files: "이상한값" }]).length, 0);
eq("path 없는 붙임은 뺀다", fileRows([{ id: "x", files: [{ name: "a" }] }]).length, 0);
eq("이름이 없어도 터지지 않는다",
   fileRows([{ id: "x", files: [{ path: "p" }] }])[0].name, "(이름 없음)");
eq("찾는 말이 비면 다 통과", matchFile(items[0], "   "), true);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
