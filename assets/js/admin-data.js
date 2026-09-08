/* =============================================================
   분석 자료 올리기 — admin/data.html

   방산·침수 화면이 읽는 자료는 깃헙이 아니라 Supabase 의 **비공개 보관함**
   (analysis) 에 있습니다. 여태는 Supabase 화면에 들어가 폴더를 찾아 끌어다
   놓으셔야 했는데, 그러다 보니 폴더 밖에 올라가거나(analysis/companies.json)
   덮어쓰기가 안 되어 옛 파일이 그대로 남는 일(network (1).json)이 있었습니다.

   여기서는 **파일 이름만 보고 갈 곳을 정해** 정확히 그 자리에 덮어씁니다.
   폴더 밖에 잘못 올라간 것도 이 화면에서 바로 지울 수 있습니다.
   ============================================================= */
import { sb, currentUser, myProfile } from "../../auth/auth.js";

const BUCKET = "analysis";
const NL = String.fromCharCode(10);

/* 어느 파일이 어느 폴더로 가는지 — 이름만 보고 정합니다.
   여기 없는 이름은 받지 않습니다. 엉뚱한 파일이 보관함에 쌓이면
   나중에 무엇이 무엇인지 알 수 없습니다. */
const WHERE = {
  "points.json":    { dir: "defense", what: "방산 — 기업·연구장비 좌표" },
  "network.json":   { dir: "defense", what: "방산 — 네트워크와 장비 키워드" },
  "companies.json": { dir: "defense", what: "방산 — 수도권 기업 명단" },
  "equip-map.png":  { dir: "defense", what: "방산 — 연구장비 시군 분포 그림" },
  "companies-edits.json": { dir: "defense", what: "방산 — 화면에서 손으로 고친 것" },
  "flood.json":     { dir: "flood",   what: "침수 — 지하공간 자료" },
};
const DIRS = [...new Set(Object.values(WHERE).map((x) => x.dir))];

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const kb = (n) => (n == null ? "—" : Math.round(Number(n) / 1024).toLocaleString("ko-KR") + " KB");

/** 올린 때 — 보관함이 알려 주는 값이 자리마다 달라 있는 대로 찾습니다 */
function when(f) {
  const t = f.updated_at || f.created_at ||
            (f.metadata && (f.metadata.lastModified || f.metadata.updated_at));
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d)) return "";
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

const app = document.getElementById("aapp");

const user = await currentUser();
if (!user) {
  location.replace("../auth/login.html?next=" + encodeURIComponent("../admin/data.html"));
  throw new Error("로그인 필요");
}
const me = await myProfile().catch(() => null);
const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
const isAdmin = !!(me && me.is_admin) ||
  OWNERS.indexOf(((user.email) || "").toLowerCase()) >= 0;
if (!isAdmin) {
  app.innerHTML = '<p style="padding:60px 0;text-align:center;color:var(--mauve)">' +
    '이 화면은 관리자만 볼 수 있습니다.<br><a href="../index.html">← 홈으로</a></p>';
  throw new Error("관리자 아님");
}

/** 보관함 한 자리를 훑습니다 — 폴더는 빼고 파일만 */
async function look(dir) {
  const r = await sb.storage.from(BUCKET).list(dir, { limit: 200 });
  if (r.error) throw r.error;
  /* 폴더는 id 가 없습니다. 「.emptyFolderPlaceholder」 도 감춥니다. */
  return (r.data || []).filter((f) => f.id && f.name !== ".emptyFolderPlaceholder");
}

let msgEl = null;
function say(text, kind) {
  if (!msgEl) return;
  msgEl.className = "amsg" + (kind ? " " + kind : "");
  msgEl.textContent = text;
}

/** 한 자리의 파일을 표로 */
function table(dir, files) {
  const want = Object.keys(WHERE).filter((n) => WHERE[n].dir === dir);
  const rows = files.map((f) => {
    const 제자리 = dir !== "" && want.indexOf(f.name) >= 0;
    /* 맨 위에 있는 자료 파일은 갈 곳을 잘못 찾은 것입니다 */
    const 헛자리 = dir === "" && (WHERE[f.name] || /\.json$/i.test(f.name));
    return '<tr' + (헛자리 ? ' class="stray"' : "") + ">" +
      "<td" + (제자리 ? ' class="want"' : "") + ">" + esc(f.name) +
        (제자리 ? '<br><span style="font-weight:400;color:var(--mauve);font-size:.8rem">' +
                  esc(WHERE[f.name].what) + "</span>" : "") +
        (헛자리 ? '<br><span style="font-weight:400;color:#8e3b2c;font-size:.8rem">' +
                  "폴더 밖에 있습니다 — 화면이 못 읽습니다</span>" : "") +
      "</td>" +
      '<td class="num">' + kb(f.metadata && f.metadata.size) + "</td>" +
      '<td class="num">' + esc(when(f)) + "</td>" +
      '<td class="num"><button type="button" class="fdel" data-p="' +
        esc((dir ? dir + "/" : "") + f.name) + '">지우기</button></td></tr>';
  }).join("");
  const 빠진것 = want.filter((n) => !files.some((f) => f.name === n));
  return '<div class="flist"><table>' +
    "<thead><tr><th>" + (dir ? esc(dir) + " 폴더" : "analysis 맨 위") +
      "</th><th>크기</th><th>올린 때</th><th></th></tr></thead>" +
    "<tbody>" + (rows ||
      '<tr><td colspan="4" style="color:var(--mauve)">비어 있습니다</td></tr>') +
    "</tbody></table></div>" +
    (빠진것.length
      ? '<p class="anote">아직 없는 것: <code>' + 빠진것.map(esc).join("</code> · <code>") +
        "</code></p>"
      : "");
}

async function draw() {
  app.innerHTML = '<p class="anote">보관함을 읽는 중…</p>';
  let 자리;
  try {
    자리 = await Promise.all([...DIRS.map(look), look("")]);
  } catch (e) {
    app.innerHTML = '<p class="amsg err">보관함을 열지 못했습니다 — ' +
      esc(String((e && e.message) || e)) + "</p>";
    return;
  }
  const 맨위 = 자리[자리.length - 1];
  const 헛것 = 맨위.filter((f) => WHERE[f.name] || /\.json$/i.test(f.name));

  app.innerHTML =
    '<label class="dz" id="dz">' +
      "<b>여기에 파일을 끌어다 놓으세요</b>" +
      "<span>또는 눌러서 고르기 · " +
        Object.keys(WHERE).map((n) => "<code>" + esc(n) + "</code>").join(" · ") +
      "<br>이름을 보고 알맞은 폴더에 <b>덮어씁니다</b>. 다른 이름은 받지 않습니다.</span>" +
      '<input type="file" id="dzf" accept=".json,.png,application/json,image/png" multiple hidden>' +
    "</label>" +
    '<p class="amsg" id="dzm"></p>' +
    (헛것.length
      ? '<p class="asec" style="color:#8e3b2c">치워야 할 것</p>' +
        '<p class="anote">아래 파일들이 <b>폴더 밖</b>에 있습니다. 화면은 이것을 못 읽습니다. ' +
        "위에 다시 올리신 뒤 여기서 지워 주세요.</p>" + table("", 헛것)
      : "") +
    DIRS.map((d, i) => '<p class="asec">' + esc(d) + " 폴더</p>" + table(d, 자리[i])).join("");

  msgEl = document.getElementById("dzm");
  wire();
}

function wire() {
  const dz = document.getElementById("dz");
  const inp = document.getElementById("dzf");
  if (!dz || !inp) return;

  inp.addEventListener("change", () => take([...inp.files]));
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("on"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, () => dz.classList.remove("on")));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    take([...(e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : [])]);
  });

  document.querySelectorAll("[data-p]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(b.dataset.p + " 를 보관함에서 지울까요?" + NL +
                   "지운 뒤에는 되돌릴 수 없습니다.")) return;
      b.disabled = true;
      const r = await sb.storage.from(BUCKET).remove([b.dataset.p]);
      if (r.error) { b.disabled = false; say("지우지 못했습니다 — " + r.error.message, "err"); return; }
      say("지웠습니다: " + b.dataset.p, "ok");
      draw();
    }));
}

async function take(files) {
  const list = (files || []).filter(Boolean);
  if (!list.length) return;
  const dz = document.getElementById("dz");
  const 모르는 = list.filter((f) => !WHERE[f.name]);
  const 아는 = list.filter((f) => WHERE[f.name]);
  if (!아는.length) {
    say("받을 수 있는 이름이 아닙니다: " + 모르는.map((f) => f.name).join(", ") + NL +
        "받는 이름: " + Object.keys(WHERE).join(" · ") + NL +
        "「network (1).json」 처럼 이름이 바뀐 것은 원래 이름으로 되돌려 주세요.", "err");
    return;
  }
  dz.classList.add("busy");
  const done = [], failed = [];
  for (const f of 아는) {
    const dir = WHERE[f.name].dir;
    const path = dir + "/" + f.name;
    say("올리는 중… " + path);
    try {
      /* upsert 를 켜야 같은 이름을 덮어씁니다 — 이것이 없으면 조용히 실패하거나
         「network (1).json」 처럼 딴 이름으로 들어갑니다. */
      const r = await sb.storage.from(BUCKET).upload(path, f, {
        upsert: true, cacheControl: "0",
        contentType: /\.png$/i.test(f.name) ? "image/png" : "application/json",
      });
      if (r.error) throw r.error;
      done.push(path + " (" + kb(f.size) + ")");
    } catch (e) {
      failed.push(f.name + " — " + String((e && e.message) || e));
    }
  }
  dz.classList.remove("busy");
  const 말 = [];
  if (done.length) 말.push("올렸습니다:" + NL + done.map((x) => "  · " + x).join(NL));
  if (failed.length) 말.push("못 올렸습니다:" + NL + failed.map((x) => "  · " + x).join(NL));
  if (모르는.length) 말.push("받지 않은 것: " + 모르는.map((f) => f.name).join(", "));
  await draw();
  say(말.join(NL), failed.length ? "err" : "ok");
}

draw();
