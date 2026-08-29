// ─── 기록에 붙이는 파일 ────────────────────────────────────
// 끌어놓기 · 붙여넣기(Ctrl+V) · 골라서 올리기 를 모두 받습니다.
// 이미지 · 엑셀(xlsx/csv) · PDF · 그 밖의 문서.
//
// 올린 뒤에는 글에서 쓸 만한 부분을 뽑아냅니다.
//   ① 내 이름·낱말이 들어간 줄을 먼저 모읍니다
//   ② 하나도 없으면 앞머리의 알맹이 줄을 몇 개 보여 줍니다
// (진짜 AI 요약이 아니라 낱말 기준입니다. 어디서 나온 줄인지 함께 적습니다.)
import { sb } from "../../auth/auth.js";

export const BUCKET = "files";

/** 내 이름·자주 쓰는 낱말 — 이 말이 든 줄을 먼저 뽑습니다 */
export const MINE = ["남지현", "지현", "Jee-Hyun", "Jeehyun", "NAM", "경기연구원"];

const MAX = 20 * 1024 * 1024;              // 한 파일 20MB 까지

// PDF 를 짧은 조각으로 끊는 기준 — 문장 끝 · 줄바꿈 · 가운뎃점 · 말줄임
const SPLIT = new RegExp("(?<=[.\u3002!?;])\s+|\n+|\s[\u00b7\u2022]\s|\.{3,}");

export const kind = (f) => {
  const n = (f.name || "").toLowerCase();
  const t = (f.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/\.(xlsx|xlsm|xls)$/.test(n)) return "excel";
  if (/\.(csv|tsv)$/.test(n)) return "csv";
  if (t.startsWith("text/") || /\.(txt|md|json)$/.test(n)) return "text";
  return "file";
};

export const niceSize = (n) =>
  n >= 1048576 ? (n / 1048576).toFixed(1) + "MB"
  : n >= 1024 ? Math.round(n / 1024) + "KB" : n + "B";

/** 클립보드·끌어놓기에서 파일을 꺼냅니다 (캡처 그림과 복사한 파일 모두) */
export function filesFrom(e) {
  const d = e.clipboardData || e.dataTransfer;
  if (!d) return [];
  const out = [], seen = new Set();
  const add = (f) => {
    if (!f) return;
    const k = f.name + "|" + f.size;
    if (seen.has(k)) return;
    seen.add(k); out.push(f);
  };
  [...(d.files || [])].forEach(add);
  [...(d.items || [])].forEach((i) => { if (i.kind === "file") add(i.getAsFile()); });
  return out;
}

/** 보관함에 올리고 붙임 목록에 넣을 정보를 돌려줍니다 */
export async function upload(file) {
  if (file.size > MAX) throw new Error(file.name + " — 20MB 를 넘습니다.");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `notes/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: "3600" });
  if (up.error) throw up.error;
  return { name: file.name, path, type: kind(file), size: file.size };
}

/** 비공개 보관함이라 볼 때마다 한 시간짜리 임시 주소를 받습니다 */
export async function signedUrl(path, sec = 3600) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, sec);
  if (error) return null;
  return data.signedUrl;
}

export async function remove(path) {
  await sb.storage.from(BUCKET).remove([path]);
}

/* ── 글 뽑아내기 ──────────────────────────────────────────── */

const LIB = {
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm",
  pdf:  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm",
};

async function readText(file) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ""));
    r.onerror = () => no(new Error("파일을 읽지 못했습니다"));
    r.readAsText(file, "utf-8");
  });
}

async function fromExcel(file) {
  const XLSX = await import(/* @vite-ignore */ LIB.xlsx);
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const out = [];
  wb.SheetNames.forEach((s) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, blankrows: false });
    rows.forEach((r) => {
      const line = r.map((c) => (c == null ? "" : String(c).trim())).filter(Boolean).join(" · ");
      if (line) out.push({ where: s, line });
    });
  });
  return out;
}

async function fromPdf(file) {
  const pdfjs = await import(/* @vite-ignore */ LIB.pdf);
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];
  for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map((x) => x.str).join(" ");
    // 문장 끝·가운뎃점·쉼표까지 끊어 조각을 짧게 만듭니다.
    // 그러지 않으면 한 쪽이 통째로 한 줄이 되어 읽을 수 없습니다.
    text.split(SPLIT).forEach((s) => {
      const line = s.replace(/\s+/g, " ").trim();
      if (line.length > 6) out.push({ where: i + "쪽", line });
    });
  }
  return out;
}

async function fromText(file) {
  const t = await readText(file);
  return t.split(/\r?\n/)
    .map((s) => ({ where: "", line: s.replace(/[,\t]+/g, " · ").trim() }))
    .filter((x) => x.line.length > 1);
}

/**
 * 파일에서 쓸 만한 부분을 뽑습니다.
 * @returns {Promise<{mine:Array, head:Array, total:number}>}
 *   mine  내 이름·낱말이 든 줄
 *   head  하나도 없을 때 보여 줄 앞머리 줄
 */
export async function extract(file, words) {
  const k = kind(file);
  let lines = [];
  try {
    if (k === "excel") lines = await fromExcel(file);
    else if (k === "pdf") lines = await fromPdf(file);
    else if (k === "csv" || k === "text") lines = await fromText(file);
    else return { mine: [], head: [], total: 0 };
  } catch (e) {
    return { mine: [], head: [], total: 0, error: e.message };
  }

  const keys = (words && words.length ? words : MINE).map((w) => w.toLowerCase());
  const hit = (s) => keys.some((w) => s.toLowerCase().includes(w));

  /* 긴 줄은 내 이름 둘레만 잘라 냅니다.
     한 쪽이 통째로 들어오면 어디가 내 얘기인지 알 수 없습니다. */
  const WIN = 90;                       // 이름 앞뒤로 남길 글자 수
  function around(line) {
    if (line.length <= WIN * 2) return line;
    const low = line.toLowerCase();
    let at = -1;
    for (const w of keys) { const i = low.indexOf(w); if (i >= 0) { at = i; break; } }
    if (at < 0) return line.slice(0, WIN * 2) + "…";
    const a = Math.max(0, at - WIN);
    const b = Math.min(line.length, at + WIN);
    return (a > 0 ? "… " : "") + line.slice(a, b).trim() + (b < line.length ? " …" : "");
  }

  const mine = lines.filter((x) => hit(x.line))
    .map((x) => ({ where: x.where, line: around(x.line) }))
    .slice(0, 25);
  const head = mine.length ? []
    : lines.filter((x) => x.line.length > 8)
           .map((x) => ({ where: x.where, line: x.line.slice(0, 180) + (x.line.length > 180 ? "…" : "") }))
           .slice(0, 8);
  return { mine, head, total: lines.length };
}

/** 뽑아낸 것을 사람이 읽는 글로 */
export function asText(name, r) {
  if (r.error) return `[${name}] 글을 뽑지 못했습니다 — ${r.error}`;
  if (!r.total) return "";
  const head = `[${name}] 전체 ${r.total}줄`;
  if (r.mine.length) {
    return head + ` · 내 이름이 든 줄 ${r.mine.length}개\n` +
      r.mine.map((x) => (x.where ? `(${x.where}) ` : "") + x.line).join("\n");
  }
  return head + " · 내 이름은 없어 앞부분만 추립니다\n" +
    r.head.map((x) => (x.where ? `(${x.where}) ` : "") + x.line).join("\n");
}
