/* =============================================================
   GRI 해외출장보고서 올리기 — admin/travel-gri.html

   11.해외출장보고_Data/ 폴더를 고르면
     gri.json                          → analysis/travel/gri.json
     [2020.0218.김은경]영국…pdf 같은 파일  → analysis/travel/gri/<번호>_<차례>.pdf  (gri.json 의 key)
   로 올립니다. 보관함 안 이름은 번호로 두고(한글·괄호가 든 이름은 주소에서 말썽을 부립니다),
   사람이 보는 이름은 gri.json 이 갖고 있어 화면에서 그 이름으로 받아집니다.

   이미 같은 크기로 올라간 파일은 건너뜁니다 — 1 GB 를 매번 다시 올리지 않습니다.
   ============================================================= */
import { sb, currentUser, myProfile } from "../../auth/auth.js";

const BUCKET = "analysis";
const DIR = "travel/gri";
const LIST = "travel/gri.json";
const NL = String.fromCharCode(10);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");

const app = document.getElementById("aapp");
const user = await currentUser();
if (!user) {
  location.replace("../auth/login.html?next=" + encodeURIComponent("../admin/travel-gri.html"));
  throw new Error("로그인 필요");
}
const me = await myProfile().catch(() => null);
const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(((user.email) || "").toLowerCase()) >= 0;
if (!isAdmin) {
  app.innerHTML = '<p style="padding:60px 0;text-align:center;color:var(--mauve)">이 화면은 관리자만 볼 수 있습니다.<br><a href="../index.html">← 홈으로</a></p>';
  throw new Error("관리자 아님");
}

/* ── 보관함에 지금 무엇이 있는지 ── */
async function remoteMap() {
  const out = new Map();
  let offset = 0;
  for (;;) {
    const r = await sb.storage.from(BUCKET).list(DIR, { limit: 1000, offset });
    if (r.error) throw new Error(r.error.message);
    (r.data || []).forEach((f) => { if (f.name && f.id) out.set(f.name, (f.metadata && f.metadata.size) || 0); });
    if (!r.data || r.data.length < 1000) break;
    offset += 1000;
  }
  return out;
}
async function remoteList() {
  const r = await sb.storage.from(BUCKET).list("travel", { limit: 100 });
  if (r.error) return null;
  return (r.data || []).find((f) => f.name === "gri.json") || null;
}

function say(text, kind) {
  const el = document.getElementById("amsg");
  if (!el) return;
  el.textContent = text; el.className = "amsg " + (kind || "");
}

async function draw() {
  let have = new Map(), listInfo = null, err = "";
  try { have = await remoteMap(); listInfo = await remoteList(); } catch (e) { err = e.message; }
  let total = 0; have.forEach((n) => { total += n; });
  const FSA = typeof window.showDirectoryPicker === "function";
  app.innerHTML =
    (err ? '<div class="aerr">보관함을 읽지 못했습니다 — ' + esc(err) + "</div>" : "") +
    '<p class="asec">보관함 (analysis/travel)</p>' +
    '<div class="astat">' +
      "<div><b>" + have.size + "</b><span>올라간 파일</span></div>" +
      "<div><b>" + mb(total) + "</b><span>모두</span></div>" +
      "<div><b>" + (listInfo ? "있음" : "없음") + "</b><span>gri.json 목록</span></div>" +
    "</div>" +
    '<p class="asec">올리기</p>' +
    (FSA
      ? '<button type="button" class="btn btn--teal abtn" id="pick">📁 11.해외출장보고_Data 폴더 고르기</button>'
      : '<label class="btn btn--teal abtn">📁 폴더 고르기<input type="file" id="pickIn" webkitdirectory multiple hidden></label>') +
    '<p class="anote">폴더를 고르면 안의 gri.json 을 읽어, 거기 적힌 파일만 알맞은 이름으로 올립니다. ' +
      "50 MB 를 넘는 파일은 Supabase 설정(Storage → Settings → File size limit)에 따라 막힐 수 있습니다 — 그런 파일은 아래에 붉게 남습니다.</p>" +
    '<div class="abar" id="abar" hidden><i></i></div>' +
    '<p class="amsg" id="amsg"></p>' +
    '<div id="flist"></div>';

  if (FSA) document.getElementById("pick").addEventListener("click", pickFolder);
  else document.getElementById("pickIn").addEventListener("change", (e) => takeFiles([...e.target.files]));
}

/* ── 폴더에서 읽기 ── */
async function pickFolder() {
  let dir;
  try { dir = await window.showDirectoryPicker({ id: "skyish-gri", mode: "read" }); }
  catch (e) { if (e.name !== "AbortError") say("폴더를 열지 못했습니다 — " + e.message, "err"); return; }
  const files = [];
  for await (const [, h] of dir.entries()) {
    if (h.kind !== "file") continue;
    files.push(await h.getFile());
  }
  await takeFiles(files);
}

async function takeFiles(files) {
  const byName = new Map(files.map((f) => [f.name, f]));
  const listFile = byName.get("gri.json");
  if (!listFile) { say("이 폴더에 gri.json 이 없습니다 — tools/travel/gri_reports.py 를 먼저 돌려 주세요.", "err"); return; }
  let doc;
  try { doc = JSON.parse(await listFile.text()); } catch (e) { say("gri.json 을 읽지 못했습니다 — " + e.message, "err"); return; }
  const posts = doc.posts || [];
  const jobs = [];
  posts.forEach((p) => (p.files || []).forEach((f) => {
    const local = byName.get(f.file);
    jobs.push({ num: p.num, name: f.file, key: f.key, size: f.size, local });
  }));
  const missing = jobs.filter((j) => !j.local);
  let have = new Map();
  try { have = await remoteMap(); } catch (e) {}

  const bar = document.getElementById("abar"); bar.hidden = false;
  const fill = bar.querySelector("i");
  const flist = document.getElementById("flist");
  const rows = [];
  const show = () => {
    flist.innerHTML = '<div class="flist"><table><thead><tr><th>번호</th><th>파일</th><th>크기</th><th>결과</th></tr></thead><tbody>' +
      rows.map((r) => `<tr><td class="num">${r.num}</td><td class="nm">${esc(r.name)}</td><td class="num">${mb(r.size)}</td><td class="${r.cls}">${esc(r.msg)}</td></tr>`).join("") +
      "</tbody></table></div>";
  };

  let done = 0, up = 0, skip = 0, bad = 0, sent = 0;
  const totalBytes = jobs.filter((j) => j.local).reduce((n, j) => n + j.local.size, 0);
  say(`파일 ${jobs.length}개 · ${mb(totalBytes)} — 올리는 중…` + (missing.length ? ` (폴더에 없는 파일 ${missing.length}개는 건너뜁니다)` : ""));

  for (const j of jobs) {
    const short = j.key.split("/").pop();
    if (!j.local) { rows.unshift({ num: j.num, name: j.name, size: j.size, cls: "bad", msg: "폴더에 없음" }); bad++; }
    else if (have.has(short) && have.get(short) === j.local.size) {
      rows.unshift({ num: j.num, name: j.name, size: j.local.size, cls: "skip", msg: "이미 있음" }); skip++; sent += j.local.size;
    } else {
      try {
        const r = await sb.storage.from(BUCKET).upload(j.key, j.local, { upsert: true, cacheControl: "3600",
          contentType: /\.pdf$/i.test(j.name) ? "application/pdf" : undefined });
        if (r.error) throw new Error(r.error.message || String(r.error));
        rows.unshift({ num: j.num, name: j.name, size: j.local.size, cls: "ok", msg: "올림" }); up++;
      } catch (e) {
        rows.unshift({ num: j.num, name: j.name, size: j.local.size, cls: "bad", msg: "실패 — " + e.message }); bad++;
      }
      sent += j.local.size;
    }
    done++;
    fill.style.width = Math.round(100 * sent / Math.max(1, totalBytes)) + "%";
    if (done % 3 === 0 || done === jobs.length) { show(); say(`${done}/${jobs.length} · 올림 ${up} · 이미 있음 ${skip} · 실패 ${bad}`); }
  }

  /* 목록은 맨 끝에 — 파일이 다 있어야 화면이 열 수 있습니다 */
  try {
    const r = await sb.storage.from(BUCKET).upload(LIST, listFile, { upsert: true, cacheControl: "60", contentType: "application/json" });
    if (r.error) throw new Error(r.error.message);
    rows.unshift({ num: "", name: "gri.json (목록 " + posts.length + "건)", size: listFile.size, cls: "ok", msg: "올림" });
  } catch (e) {
    rows.unshift({ num: "", name: "gri.json", size: listFile.size, cls: "bad", msg: "실패 — " + e.message }); bad++;
  }
  show();
  say(`끝 — 올림 ${up} · 이미 있음 ${skip} · 실패 ${bad}` + (bad ? NL + "붉은 줄은 다시 눌러 보시고, 그래도 막히면 Supabase 의 파일 크기 제한을 확인해 주세요." : ""), bad ? "err" : "ok");
}

draw();
