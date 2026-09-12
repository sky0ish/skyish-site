/* =============================================================
   GRI 해외출장보고서 — travel-gri.html

   「경기연구원의 출장보고서 게시판에서 가져와서 [Travel]안에 GRI출장보고서 로 모두 긁어와줘.
     pdf를 그대로 가져오되 … 게시판 본문상에는 보고서를 요약해서 넣어줘.」

   자료는 모두 비공개 보관함(analysis) 에 있습니다 —
     travel/gri.json            목록·요약 (tools/travel/gri_reports.py 가 만듭니다)
     travel/gri/<번호>_<차례>.pdf 보고서 원본 (admin/travel-gri.html 에서 올립니다)
   깃헙에는 한 장도 올라가지 않습니다. 파일은 누를 때 한 시간짜리 임시 주소를 받아 엽니다.
   ============================================================= */
import { sb, loadAnalysisJson } from "../../auth/auth.js";

const BUCKET = "analysis";
const LIST = "travel/gri.json";
const SIGN_SEC = 60 * 60;
const NL = String.fromCharCode(10);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

/* travel.html 의 권역과 같은 갈래 */
const REGIONS = [
  ["all", "전체"], ["europe", "유럽"], ["japan", "일본"], ["usa", "미국"], ["china", "중국"], ["etc", "기타"],
];

let posts = [];
let q = "", region = "all", year = "";
const open = new Set();
const signed = new Map();            // key → { url, till }

/** 보관함의 임시 주소 — 같은 파일은 한 시간 안에 다시 만들지 않습니다 */
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

/** 찾기 — 제목·출장자·나라·요약·게시글 제목 어디든 */
function hit(p) {
  if (region !== "all" && (p.regions || []).indexOf(region) < 0) return false;
  if (year && String(p.year) !== year) return false;
  if (!q) return true;
  const s = q.toLowerCase();
  return [p.trip, p.title, p.postTitle, (p.travelers || []).join(" "), (p.countries || []).join(" "),
          p.summary, (p.points || []).join(" "), p.where, p.who]
    .join(" ").toLowerCase().indexOf(s) >= 0;
}

function dateText(p) {
  if (p.day) return `${p.year}.${String(p.month).padStart(2, "0")}.${String(p.day).padStart(2, "0")}`;
  if (p.month) return `${p.year}.${String(p.month).padStart(2, "0")}`;
  return p.year || "";
}

function row(p, i, total) {
  const who = (p.travelers || []).length
    ? `<b>${esc(p.travelers[0])}</b>${p.travelers.length > 1 ? ` 외 ${p.travelers.length - 1}명` : ""}` : "";
  const main = (p.files || []).find((f) => f.main) || (p.files || [])[0] || {};
  const tags = ((p.files || []).some((f) => f.kind !== "pdf") ? '<span class="tb__tag is-hwp">HWP</span>' : "") +
    (main.kind === "pdf" && !main.textChars ? '<span class="tb__tag is-scan">스캔</span>' : "") +
    ((p.files || []).length > 1 ? `<span class="tb__tag">첨부 ${p.files.length}</span>` : "");
  const isOpen = open.has(p.num);
  return '<li class="tb__row' + (isOpen ? " is-open" : "") + '" data-num="' + p.num + '">' +
      '<span class="tb__num">' + (total - i) + "</span>" +
      '<span class="tb__main">' +
        '<span class="tb__title"><a class="tb__link" href="#" data-open="' + p.num + '">' + esc(p.trip || p.postTitle) + "</a>" + tags + "</span>" +
        '<span class="tb__who">' + who + (who && (p.countries || []).length ? " · " : "") + esc((p.countries || []).join(", ")) +
          (p.period ? ' <span style="opacity:.75">· ' + esc(p.period) + "</span>" : "") + "</span>" +
      "</span>" +
      '<span class="tb__place">' + esc((p.countries || []).join(", ")) + "</span>" +
      '<span class="tb__date">' + esc(dateText(p)) + "</span>" +
      (isOpen ? detail(p) : "") +
    "</li>";
}

function detail(p) {
  const meta = [["출장명", p.trip], ["기간", p.period], ["지역", p.where || (p.countries || []).join(", ")], ["출장자", p.who || (p.travelers || []).join(", ")]]
    .filter(([, v]) => v).map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join("");
  const files = (p.files || []).map((f, i) =>
    `<span class="gri-file"><span class="nm" title="${esc(f.file)}">${esc(f.file)}</span>` +
    `<span class="sz">${mb(f.size || 0)}</span>` +
    `<button type="button" data-view="${p.num}|${i}">열기</button>` +
    `<button type="button" data-dl="${p.num}|${i}">받기</button></span>`).join("");
  /* 요약이 없으면 게시글 개요라도 — 그것도 첨부 이름뿐이면 왜 없는지 적습니다 */
  const gist = (p.body || "").replace(/^[^□]*□/, "□");
  const main0 = (p.files || []).find((f) => f.main) || (p.files || [])[0] || {};
  const why = main0.kind && main0.kind !== "pdf" ? "한글(hwp) 파일이라 글자를 뽑지 못해 요약이 없습니다."
    : main0.kind === "pdf" && !main0.textChars ? "스캔한 문서라 글자를 뽑지 못해 요약이 없습니다 — PDF 원문을 열어 보세요."
    : "요약이 아직 없습니다.";
  const sum = p.summary ? `<p class="gri-sum">${esc(p.summary)}</p>` :
    `<p class="gri-sum" style="color:var(--mauve)">${/출장/.test(gist) && gist.length > 40 ? esc(gist) + NL + why : esc(why)}</p>`;
  const pts = (p.points || []).length ? "<ul class=\"gri-pts\">" + p.points.map((x) => `<li>${esc(x)}</li>`).join("") + "</ul>" : "";
  return '<div class="gri-open">' +
      "<h4>요약</h4>" + sum + pts +
      (meta ? '<div class="gri-meta">' + meta + "</div>" : "") +
      '<div class="gri-files">' + (files || '<span class="gri-note">붙은 파일이 없습니다.</span>') + "</div>" +
      '<div class="gri-src">그룹웨어 해외출장보고 게시판 ' + p.num + "번 · " + esc(p.postTitle) +
        " · 게시 " + esc(p.poster || "") + " " + esc(p.posted || "") + "</div>" +
    "</div>";
}

function paint() {
  const mount = document.getElementById("gri-board");
  const L = posts.filter(hit);
  const years = {};
  posts.forEach((p) => { if (p.year) years[p.year] = (years[p.year] || 0) + 1; });
  const count = (k) => (k === "all" ? posts : posts.filter((p) => (p.regions || []).indexOf(k) >= 0)).length;

  mount.innerHTML =
    '<nav class="tregions" aria-label="권역">' +
      '<a href="travel.html">← Travel</a>' +
      REGIONS.map(([k, l]) => `<a href="#" data-region="${k}"${k === region ? ' class="on" aria-current="page"' : ""}>${esc(l)} <span class="tregions__n">${count(k)}</span></a>`).join("") +
    "</nav>" +
    '<div class="gri-bar">' +
      '<input type="search" id="gri-q" placeholder="출장명 · 출장자 · 나라 · 요약으로 찾기" value="' + esc(q) + '" autocomplete="off">' +
      '<select id="gri-year"><option value="">모든 해</option>' +
        Object.keys(years).sort().reverse().map((y) => `<option value="${y}"${y === year ? " selected" : ""}>${y} (${years[y]})</option>`).join("") +
      "</select>" +
      '<span class="tb__count"><strong>' + L.length + "</strong>건" + (L.length !== posts.length ? " · 모두 " + posts.length + "건" : "") + "</span>" +
    "</div>" +
    '<ul class="tb tb--gri">' +
      '<li class="tb__head"><span>번호</span><span>출장명</span><span>지역</span><span>출발</span></li>' +
      (L.length ? L.map((p, i) => row(p, i, L.length)).join("") :
        '<li class="tb__row"><span></span><span class="tb__main">찾으시는 보고서가 없습니다.</span><span></span><span></span></li>') +
    "</ul>";

  mount.querySelectorAll("[data-region]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); region = a.dataset.region; paint();
  }));
  const qi = document.getElementById("gri-q");
  let t = null;
  qi.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { q = qi.value.trim(); paint(); qi2(); }, 250); });
  const qi2 = () => { const el = document.getElementById("gri-q"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
  document.getElementById("gri-year").addEventListener("change", (e) => { year = e.target.value; paint(); });

  mount.querySelectorAll(".tb__row[data-num]").forEach((li) => li.addEventListener("click", (e) => {
    if (e.target.closest("button, .gri-open a")) return;
    e.preventDefault();
    const n = Number(li.dataset.num);
    if (open.has(n)) open.delete(n); else open.add(n);
    paint();
  }));
  mount.querySelectorAll("[data-view],[data-dl]").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    const dl = b.dataset.dl != null;
    const [num, i] = (dl ? b.dataset.dl : b.dataset.view).split("|").map(Number);
    const p = posts.find((x) => x.num === num); const f = p && p.files[i];
    if (!f) return;
    b.disabled = true; const was = b.textContent; b.textContent = "…";
    try {
      const url = await urlOf(f.key, dl ? f.file : "");
      if (dl) { location.href = url; }
      else { window.open(url, "_blank", "noopener"); }
    } catch (err) {
      alert("파일을 열지 못했습니다 — " + err.message + "\n(아직 올리지 않은 파일이거나 열람 권한이 없습니다)");
    } finally { b.disabled = false; b.textContent = was; }
  }));
}

async function start() {
  const mount = document.getElementById("gri-board");
  if (!mount) return;
  try {
    const doc = await loadAnalysisJson(LIST);
    posts = (doc.posts || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || b.num - a.num);
  } catch (e) {
    mount.innerHTML = '<div class="gri-err">목록(analysis/' + esc(LIST) + ')을 읽지 못했습니다 — ' + esc(e.message) +
      "\n관리자라면 admin/travel-gri.html 에서 「11.해외출장보고_Data」 폴더를 올려 주세요.</div>";
    return;
  }
  const want = new URLSearchParams(location.search);
  if (want.get("region")) region = want.get("region");
  if (want.get("q")) q = want.get("q");
  paint();
}
start();
