// ─── 행사 정보 글 → 개최개요.json (명령줄) ─────────────────────
//   세미나회의록.py 가 info 의 PDF 글을 뽑아 이 스크립트에 넘기고, 나온 json 을 폴더에 놓아 둡니다.
//   홈페이지(notes.js)가 쓰는 notes-seminar.js 와 같은 셈이라 두 쪽이 어긋나지 않습니다.
//
//   쓰는 법 :  node tools/seminar/brief.mjs "<폴더 이름>" < 글.txt   → json (stdout)
import { parseBrief, briefJson } from "../../assets/js/notes-seminar.js";
import { parseFolder, tagFor } from "../../assets/js/notes-workshop.js";

const name = process.argv[2] || "";
const info = parseFolder(name);
info.tag = tagFor(info.kind);
let text = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) text += chunk;
const b = parseBrief(text, info);
const enough = b.presenters.length || b.discussants.length || b.time || b.place || b.mc.length || b.chair.length;
if (!enough) { process.stdout.write("{}"); process.exit(0); }
b.src = process.argv[3] || "행사 정보(info)";
process.stdout.write(JSON.stringify(briefJson(b, info), null, 1));
