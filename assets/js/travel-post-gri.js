/* =============================================================
   여행 글 위에 「이 여행의 출장보고서」 — travel-post.html

   「출장보고서 중 내 이름으로 되어 있는 건, Travel 에서 내가 다녀온 여행 중 겹치는 시기가 있으면
     해당 보고서를 이 화면 위쪽에서 다운로드 가능하게 해줘.」

   · 출장자에 내 이름이 든 보고서만 봅니다 (ME)
   · 여행 글의 제목 「[2024.2.26~3.6] …」 의 날짜와 보고서의 출장기간이 하루라도 겹치면 붙입니다
   · 목록(gri.json)과 PDF 는 비공개 보관함(analysis)에 있어 로그인·승인된 분한테만 보입니다 —
     손님에게는 아무것도 그리지 않습니다 (여행 글 자체는 공개 그대로)
   ============================================================= */
import { sb, analysisAccess, loadAnalysisJson } from "../../auth/auth.js";

const ME = ["남지현"];
const BUCKET = "analysis";
const LIST = "travel/gri.json";
const SIGN_SEC = 60 * 60;

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const fmt = (t) => t.getUTCFullYear() + "." + String(t.getUTCMonth() + 1).padStart(2, "0") + "." + String(t.getUTCDate()).padStart(2, "0");

/** 여행 글의 기간 — 제목 「[2024.2.26~3.6]」 「[2020.2.18~28]」, 없으면 date 「2024.03」 의 그 달 */
export function travelRange(post) {
  const t = String((post && post.title) || "");
  let m = t.match(/^\s*\[\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\s*[~\-–]\s*(?:(\d{1,2})\.)?(\d{1,2})\s*\]/);
  if (m) {
    const y = +m[1], m1 = +m[2], d1 = +m[3], m2 = m[4] ? +m[4] : m1, d2 = +m[5];
    const y2 = m2 < m1 ? y + 1 : y;
    return { from: day(y, m1, d1), to: day(y2, m2, d2) };
  }
  m = String((post && post.date) || "").match(/^(\d{4})\.(\d{1,2})/);
  if (m) {
    const y = +m[1], mo = +m[2];
    return { from: day(y, mo, 1), to: day(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 0) };
  }
  return null;
}

/** 보고서의 기간 — 시작은 date, 끝은 period 의 마지막 「월.일」 (없으면 시작 + 7일) */
export function reportRange(p) {
  const m = String((p && p.date) || "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = m[3] ? +m[3] : 1;
  const from = day(y, mo, d);
  /* 연도(2017. / 2017년 / ‘15.) 를 지운 뒤 「월.일」 짝만 봅니다 — 「2017. 5」 의 「17. 5」 가 잡히지 않게 */
  const s = String((p && p.period) || "").replace(/[‘’']\s*\d{2}\s*[.년]\s*/g, " ").replace(/(19|20)\d{2}\s*[.년]\s*/g, " ");
  const pairs = [...s.matchAll(/(\d{1,2})\s*[.월]\s*(\d{1,2})\s*일?/g)].map((x) => [+x[1], +x[2]])
    .filter(([a, b]) => a >= 1 && a <= 12 && b >= 1 && b <= 31);
  let to;
  if (pairs.length >= 2 || (pairs.length === 1 && (pairs[0][0] !== mo || pairs[0][1] !== d))) {
    const [em, ed] = pairs[pairs.length - 1];
    to = day(em < mo ? y + 1 : y, em, ed);
  } else if (!m[3]) {
    to = day(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 0);        // 달만 아는 것은 그 달 전체
  } else {
    to = new Date(from.getTime() + 7 * 86400000);
  }
  if (to < from) to = from;
  return { from, to };
}

export const overlaps = (a, b) => !!(a && b && a.from <= b.to && b.from <= a.to);
export const isMine = (p) => ME.some((n) => (p.travelers || []).indexOf(n) >= 0 || String(p.who || "").indexOf(n) >= 0);

/** 이 여행 글에 붙을 보고서들 */
export function matchReports(post, reports) {
  const r = travelRange(post);
  if (!r) return [];
  return (reports || []).filter((p) => isMine(p) && overlaps(r, reportRange(p)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

const signed = new Map();
async function urlOf(key, downloadName) {
  const k = key + (downloadName ? "|dl" : "");
  const hit = signed.get(k);
  if (hit && hit.till > Date.now()) return hit.url;
  const opt = downloadName ? { download: downloadName.replace(/[&#+?%]/g, "_") } : undefined;
  const r = await sb.storage.from(BUCKET).createSignedUrl(key, SIGN_SEC, opt);
  if (r.error || !r.data) throw new Error(r.error ? r.error.message : "주소를 못 만들었습니다");
  signed.set(k, { url: r.data.signedUrl, till: Date.now() + (SIGN_SEC - 120) * 1000 });
  return r.data.signedUrl;
}

function css() {
  if (document.getElementById("tgri-css")) return;
  const st = document.createElement("style"); st.id = "tgri-css";
  st.textContent =
    ".tgri{margin:0 0 1.6rem;padding:1rem 1.2rem;border:1px solid #cfe3df;border-left:4px solid var(--teal,#4f9d92);" +
    "border-radius:var(--radius-md,12px);background:#f3faf8}" +
    ".tgri h3{margin:0 0 .5rem;font-size:.95rem;color:var(--ink,#1c1a19)}.tgri h3 small{font-weight:400;color:var(--mauve,#7d7768);margin-left:.5em}" +
    ".tgri ul{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}" +
    ".tgri li{display:flex;flex-wrap:wrap;gap:.35rem .8rem;align-items:center;font-size:.9rem}" +
    ".tgri .t{font-weight:600;color:var(--ink,#1c1a19);flex:1 1 320px;line-height:1.45}" +
    ".tgri .t small{display:block;font-weight:400;color:var(--mauve,#7d7768);font-size:.82rem}" +
    ".tgri button{all:unset;cursor:pointer;color:var(--teal-text,#2f7d6f);font-weight:600;padding:.2rem .6rem;border:1px solid #bcd9d3;" +
    "border-radius:999px;background:#fff;font-size:.84rem}.tgri button:hover{background:#e3f2ef}.tgri button[disabled]{opacity:.5;cursor:default}" +
    ".tgri .more{font-size:.82rem;color:var(--mauve,#7d7768);margin:.6rem 0 0}.tgri .more a{color:var(--teal-text,#2f7d6f)}";
  document.head.appendChild(st);
}

function render(post, hits) {
  const head = document.querySelector(".tpost__head");
  if (!head || document.querySelector(".tgri")) return;
  css();
  const box = document.createElement("aside");
  box.className = "tgri";
  box.innerHTML =
    "<h3>📄 이 여행의 경기연구원 출장보고서<small>" + hits.length + "건 · 출장기간이 겹치는 내 보고서</small></h3>" +
    "<ul>" + hits.map((p, i) => {
      const r = reportRange(p);
      const files = (p.files || []).map((f, j) =>
        `<button type="button" data-view="${i}|${j}" title="${esc(f.file)}">${(p.files.length > 1 ? (j + 1) + " · " : "")}열기</button>` +
        `<button type="button" data-dl="${i}|${j}" title="${esc(f.file)} (${mb(f.size)})">받기</button>`).join("");
      return `<li><span class="t">${esc(p.trip || p.postTitle)}<small>${esc(p.period || (r ? fmt(r.from) + " ~ " + fmt(r.to) : ""))}` +
        (p.countries && p.countries.length ? " · " + esc(p.countries.join(", ")) : "") + "</small></span>" + files + "</li>";
    }).join("") + "</ul>" +
    '<p class="more">요약·전체 목록은 <a href="travel-gri.html">GRI 출장보고서</a> 에 있습니다. 파일은 로그인·승인된 분만 열 수 있습니다.</p>';
  head.insertAdjacentElement("afterend", box);
  box.querySelectorAll("[data-view],[data-dl]").forEach((b) => b.addEventListener("click", async () => {
    const dl = b.dataset.dl != null;
    const [i, j] = (dl ? b.dataset.dl : b.dataset.view).split("|").map(Number);
    const f = hits[i] && hits[i].files[j];
    if (!f) return;
    b.disabled = true; const was = b.textContent; b.textContent = "…";
    try {
      const url = await urlOf(f.key, dl ? f.file : "");
      if (dl) location.href = url; else window.open(url, "_blank", "noopener");
    } catch (e) { alert("파일을 열지 못했습니다 — " + e.message); }
    finally { b.disabled = false; b.textContent = was; }
  }));
}

async function start() {
  /* 여행 글은 main.js 가 그립니다 — 그려질 때까지 잠깐 기다립니다 */
  for (let i = 0; i < 40 && !document.querySelector(".tpost__head"); i++) await new Promise((r) => setTimeout(r, 100));
  const slug = new URLSearchParams(location.search).get("p");
  const posts = window.TRAVEL_POSTS || [];
  const post = posts.find((x) => x.slug === slug) || posts[Number(slug)] || null;
  if (!post || !travelRange(post)) return;
  let access;
  try { access = await analysisAccess(); } catch (e) { return; }
  if (!access || access.state !== "ok") return;                   // 손님·승인 전에는 아무것도 안 그립니다
  let doc;
  try { doc = await loadAnalysisJson(LIST); } catch (e) { return; }
  const hits = matchReports(post, doc.posts || []);
  if (hits.length) render(post, hits);
}

if (typeof document !== "undefined" && document.getElementById("travel-post")) start();
