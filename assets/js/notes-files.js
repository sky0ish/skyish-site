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

/** 내 이름 — 이 말이 든 줄을 먼저 뽑습니다.
 *  「지현」 「NAM」 「경기연구원」 처럼 넓은 말은 넣지 않습니다.
 *  넣으면 Vietnam 이 NAM 에 걸리고, 경기연구원 사람이 모두 같은 자리로 잡힙니다. */
export const MINE = ["남지현", "Jee-Hyun", "Jeehyun"];

const MAX = 20 * 1024 * 1024;              // 한 파일 20MB 까지

// PDF 를 짧은 조각으로 끊는 기준 — 문장 끝 · 줄바꿈 · 가운뎃점 · 말줄임
const SPLIT = /(?<=[.。!?;])\s+|\n+|\s[·•]\s|\.{3,}/;

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

/* ── 만난 사람 합치기 ──
   있던 이름은 지우지 않습니다. 같은 사람이면 소속이 붙은 쪽으로 채웁니다.
   「박진우」와 「박진우 (수원시정연구원)」은 한 사람으로 봅니다. */
export function mergePeople(cur, list) {
  const bare = (s) => String(s).replace(/\s*\(.*$/, "").trim();
  const has = String(cur || "").split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  (list || []).forEach((p) => {
    const i = has.findIndex((h) => bare(h) === bare(p));
    if (i < 0) has.push(p);
    else if (has[i].length < p.length) has[i] = p;
  });
  return has.join(", ");
}

/** 이미 올려 둔 붙임 파일을 도로 내려받아 File 로 돌려줍니다.
 *  올린 뒤에 글 뽑기 규칙이 좋아졌을 때, 다시 읽히려고 씁니다. */
export async function fileFromStore(f) {
  const { data, error } = await sb.storage.from(BUCKET).download(f.path);
  if (error) throw error;
  return new File([data], f.name || "file", { type: data.type || "" });
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
  const out = [], blocks = [];
  wb.SheetNames.forEach((s) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, blankrows: false });
    const got = [];
    rows.forEach((r) => {
      const line = r.map((c) => (c == null ? "" : String(c).trim())).filter(Boolean).join(" · ");
      if (line) { out.push({ where: s, line }); got.push(line); }
    });
    // 시트마다 한 덩이로 묶어 두면 사람·행사명 뽑기가 엑셀에서도 됩니다
    if (got.length) blocks.push({ where: s, text: got.join(" ") });
  });
  out.blocks = blocks;
  return out;
}

async function fromPdf(file) {
  const pdfjs = await import(/* @vite-ignore */ LIB.pdf);
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [], blocks = [];
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
    blocks.push({ where: i + "쪽", text: text.replace(/\s+/g, " ") });
  }
  out.blocks = blocks;
  return out;
}

async function fromText(file) {
  const t = await readText(file);
  const out = t.split(/\r?\n/)
    .map((s) => ({ where: "", line: s.replace(/[,\t]+/g, " · ").trim() }))
    .filter((x) => x.line.length > 1);
  out.blocks = [{ where: "", text: t.replace(/\s+/g, " ") }];
  return out;
}

/* ── 나와 같은 자리에 있던 사람 ─────────────────────────────
   학술대회 프로그램·회의자료는 「이름 (소속)」 꼴로 적힙니다.
   내 이름 둘레의 한 묶음 안에서 그 꼴을 모두 거두어들입니다.
   같은 세션에 이름이 올라 있으면 그 자리에 함께 있었다고 봅니다. */
const NAME_RE = /([가-힣]{2,4})\s*\(([^)]{1,24})\)/g;
const NOT_NAME =
  /^(사회|발제|토론|좌장|사회자|발표|참석|주최|주관|후원|장소|일시|프로그램|시상식|개회식|폐회식|기조연설|법률안|자료집|휴식|중식|만찬|등록)$/;
// 괄호 안이 시각·햇수뿐이면 사람이 아닙니다 — 「시상식 (10:00-12:00)」 같은 것
const NOT_ORG = /^[\d\s:~\-.,년월일시분초]+$/;

/* 묶음(분과·세션)이 바뀌는 자리 — 뽑은 글을 여기서 끊습니다 */
const SESSION_CUT = /(?=\d{1,2}\s*분과)|(?=제\s*\d+\s*세션)|(?=Session\s*\d)/g;

export function peopleNear(blocks, words) {
  const keys = (words && words.length ? words : MINE).map((w) => w.toLowerCase());
  const found = new Map();               // 이름 → 소속

  /* 한 쪽을 세션 단위로 끊습니다.
     「N분과」 「7F_소회의실」 「사회:」 가 새 세션의 시작 표시입니다.
     이렇게 끊지 않으면 앞뒤 세션 사람까지 딸려 옵니다. */
  const CUT = /(?=\d+\s*분과)|(?=\d+F[_\s])|(?=사회\s*[:：])/g;

  (blocks || []).forEach((b) => {
    const t = b.text || "";
    t.split(CUT).forEach((seg) => {
      const low = seg.toLowerCase();
      if (!keys.some((w) => low.includes(w))) return;   // 내 이름이 없는 세션은 건너뜁니다
      let m;
      NAME_RE.lastIndex = 0;
      while ((m = NAME_RE.exec(seg))) {
        const name = m[1].trim(), org = m[2].trim();
        if (NOT_NAME.test(name)) continue;
        if (NOT_ORG.test(org)) continue;
        if (keys.some((w) => name.toLowerCase().includes(w))) continue;   // 나는 뺍니다
        if (!found.has(name)) found.set(name, org);
      }
    });
  });

  return [...found.entries()].map(([n, o]) => (o ? n + " (" + o + ")" : n));
}


/* ── 행사 이름 ──────────────────────────────────────────────
   프로그램·초청장의 앞쪽에 큰 글씨로 적히는 이름을 찾습니다.
   「2026 한국지방자치학회 하계학술대회」 같은 꼴입니다. */
const EVENT_WORD =
  "학술대회|하계대회|동계대회|춘계대회|추계대회|세미나|심포지엄|심포지움|포럼|" +
  "토론회|공청회|워크숍|워크샵|간담회|설명회|보고회|발표회|컨퍼런스|콘퍼런스|" +
  "총회|자문회의|착수보고|중간보고|최종보고|기념식|개소식|현장답사|정책토론|연찬회";
const EVENT_RE = new RegExp("[가-힣A-Za-z0-9][^\n]{0,48}?(" + EVENT_WORD + ")", "g");
// 이 말부터가 진짜 이름입니다 — 앞에 붙은 군더더기를 잘라 낼 자리
const EVENT_HEAD = new RegExp("(제\\s*\\d+\\s*회|20\\d\\d|[가-힣]{2,}(?:학회|연구원|협회|재단|시청|도청|본부|위원회|대학교))");

export function eventName(blocks, lines) {
  const src = [];
  (blocks || []).slice(0, 2).forEach((b) => src.push(b.text || ""));
  if (!src.length) (lines || []).slice(0, 40).forEach((x) => src.push(x.line || ""));

  const seen = new Map();
  src.forEach((t) => {
    let m;
    EVENT_RE.lastIndex = 0;
    while ((m = EVENT_RE.exec(t))) {
      let s = m[0].replace(/\s+/g, " ").trim();
      const cut = s.search(EVENT_HEAD);          // 「2026…」 「제12회…」 부터 남깁니다
      if (cut > 0) s = s.slice(cut);
      s = s.replace(/^[^가-힣A-Za-z0-9]+/, "").trim();
      if (s.length < 5 || s.length > 60) continue;
      // 해·횟수가 붙어 있으면 더 그럴듯한 이름으로 봅니다
      const score = (/20\d\d/.test(s) ? 2 : 0) +
                    (/제\s*\d+\s*회/.test(s) ? 2 : 0) + s.length / 100;
      if (!seen.has(s) || seen.get(s) < score) seen.set(s, score);
    }
  });

  const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "";
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
    else return { mine: [], head: [], people: [], event: "", total: 0 };
  } catch (e) {
    return { mine: [], head: [], people: [], event: "", total: 0, error: e.message };
  }

  const keys = (words && words.length ? words : MINE).map((w) => w.toLowerCase());
  const hit = (s) => keys.some((w) => s.toLowerCase().includes(w));

  /* 긴 줄은 내 이름 둘레만 잘라 냅니다.
     한 쪽이 통째로 들어오면 어디가 내 얘기인지 알 수 없습니다. */
  const WIN = 90;                       // 이름 앞뒤로 남길 글자 수
  function around(line) {
    if (line.length <= WIN * 2) return line;

    /* 「8분과 …」 처럼 묶음이 나뉘어 있으면 내 이름이 든 묶음만 통째로 남깁니다.
       그러면 앞 묶음의 제목까지 함께 와서 무슨 자리였는지 알 수 있습니다. */
    const seg = line.split(SESSION_CUT)
      .find((p) => keys.some((w) => p.toLowerCase().includes(w)));
    if (seg && seg.length <= 700) return seg.trim();

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
  const people = peopleNear(lines.blocks, words);
  const event = eventName(lines.blocks, lines);

  /* 내 이름이 없으면 알맹이가 있는 줄만 골라 앞에서 몇 개 보여 줍니다.
     쪽번호·목차처럼 뜻이 없는 줄은 뺍니다. */
  const head = mine.length ? []
    : lines.filter((x) => x.line.length > 12 && /[가-힣]{2,}/.test(x.line) &&
                          !/^[\d\s.·-]+$/.test(x.line))
           .map((x) => ({ where: x.where, line: x.line.slice(0, 180) + (x.line.length > 180 ? "…" : "") }))
           .slice(0, 8);

  return { mine, head, people, event, total: lines.length };
}

/** 뽑아낸 것을 사람이 읽는 글로 */
export function asText(name, r) {
  const NL = String.fromCharCode(10);
  if (r.error) return "━ " + name + NL + "글을 뽑지 못했습니다 — " + r.error;
  if (!r.total) {
    return "━ " + name + NL +
      "글자를 찾지 못했습니다. 그림으로만 된 PDF 이면 글을 뽑을 수 없습니다.";
  }

  const out = ["━ " + name + " · 전체 " + r.total + "줄"];
  if (r.event) out.push("행사: " + r.event);
  if (r.people && r.people.length) out.push("사람: " + r.people.join(", "));

  if (r.mine.length) {
    out.push("");
    out.push("◆ 나와 관련된 대목 " + r.mine.length + "곳");
    r.mine.forEach((x) => out.push("· " + (x.where ? "(" + x.where + ") " : "") + x.line));
  } else if (r.head.length) {
    out.push("");
    out.push("◆ 내 이름은 보이지 않아 핵심만 추립니다");
    r.head.forEach((x) => out.push("· " + (x.where ? "(" + x.where + ") " : "") + x.line));
  }
  return out.join(NL);
}
