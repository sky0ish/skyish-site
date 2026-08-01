/* content/blog/*.md  →  assets/data/posts.js
 *
 * Decap CMS 가 저장한 마크다운 글들을 사이트가 읽는 posts.js 로 변환합니다.
 * 외부 패키지 없이 Node 표준 모듈만 씁니다.
 *
 *   node tools/build-posts.mjs
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "blog");
const DEST = path.join(ROOT, "assets", "data", "posts.js");

const CAT_LABEL = {
  daily: "Daily Life",
  arch: "Portfolio · Architecture",
  urban: "Portfolio · Urban",
  future: "Future HOME",
  dream: "My dream"
};

/* ── YAML front matter (스칼라 키만) ───────────────────────── */
function splitFrontMatter(raw) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: {}, body: text.trim() };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    data[kv[1]] = v;
  }
  return { data, body: text.slice(m[0].length).trim() };
}

/* ── 마크다운 → HTML (블로그에 필요한 범위만) ───────────────── */
function inline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      (_, t, href) => {
        const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${href}"${ext}>${t}</a>`;
      })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "<strong>$2</strong>")
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_/g, "$1<em>$2</em>");
}

function markdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];
  let list = null;          // "ul" | "ol"
  let quote = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push("<p>" + inline(para.join("\n")).replace(/\n/g, "<br>") + "</p>");
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    out.push("<blockquote>" + inline(quote.join(" ")) + "</blockquote>");
    quote = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) { flushAll(); continue; }

    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flushAll();
      const lv = Math.min(6, Math.max(3, m[1].length + 2)); // #→h3 로 낮춤
      out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flushAll(); out.push("<hr>"); continue; }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); continue; }

    if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ul") { flushList(); out.push("<ul>"); list = { tag: "ul" }; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ol") { flushList(); out.push("<ol>"); list = { tag: "ol" }; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    if (/^\s*<\/?[a-zA-Z][\s\S]*>\s*$/.test(line)) { flushAll(); out.push(line.trim()); continue; }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

/* ── 유틸 ─────────────────────────────────────────────────── */
const jsStr = (s) => JSON.stringify(String(s == null ? "" : s));

function plain(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function dotted(iso) {                       // 2026-08-01 → 2026.08.01
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[1]}.${m[2]}.${m[3]}` : String(iso || "");
}

/* ── 빌드 ─────────────────────────────────────────────────── */
async function build() {
  if (!existsSync(SRC)) {
    console.error(`[build-posts] ${SRC} 가 없습니다 — 빈 목록으로 생성합니다.`);
  }
  const files = existsSync(SRC)
    ? (await readdir(SRC)).filter((f) => f.toLowerCase().endsWith(".md"))
    : [];

  const posts = [];
  for (const f of files.sort()) {
    const raw = await readFile(path.join(SRC, f), "utf8");
    const { data, body } = splitFrontMatter(raw);
    if (!data.title) { console.warn(`[build-posts] 제목 없음, 건너뜀: ${f}`); continue; }

    const cat = (data.category || "daily").trim();
    let html = markdown(body);
    if (data.cover) {
      html = `<figure class="post__cover"><img src="${data.cover}" alt="${data.title}" loading="lazy"></figure>\n` + html;
    }
    const excerpt = (data.excerpt || "").trim() || plain(markdown(body)).slice(0, 110);

    posts.push({
      sort: String(data.date || ""),
      date: dotted(data.date),
      title: data.title,
      catLabel: CAT_LABEL[cat] || CAT_LABEL.daily,
      cats: [cat],
      excerpt,
      body: html,
      file: f
    });
  }

  posts.sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0));

  const lines = posts.map((p) =>
    [
      "  {",
      `    date: ${jsStr(p.date)},`,
      `    title: ${jsStr(p.title)},`,
      `    catLabel: ${jsStr(p.catLabel)},`,
      `    cats: ${JSON.stringify(p.cats)},`,
      `    excerpt: ${jsStr(p.excerpt)},`,
      `    body: ${jsStr(p.body)}`,
      "  }"
    ].join("\n")
  );

  const outText =
`/* =============================================================
   블로그 글 데이터 — 자동 생성 파일. 직접 고치지 마세요.
   원본은 content/blog/*.md 이며, 글쓰기는 /admin/ (Decap CMS)에서 합니다.
   재생성:  node tools/build-posts.mjs
   글 ${posts.length}편
   ============================================================= */
window.POSTS = [
${lines.join(",\n")}
];
`;

  await mkdir(path.dirname(DEST), { recursive: true });
  await writeFile(DEST, outText, "utf8");
  console.log(`[build-posts] ${posts.length}편 → assets/data/posts.js`);
}

build().catch((e) => { console.error(e); process.exit(1); });
