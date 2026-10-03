/* Gallery 노트의 항목별 그림 더하기 · 빼기 (관리자)
   ─ 노트가 열릴 때 decorate(det, kind, id) 를 부르면
     · 항목(1) 2) …의 h4) 마다 「＋ 이미지」 단추 — 파일 고르기 · 끌어다 놓기 · 붙여넣기(Ctrl+V) · 인터넷 그림 주소
     · 그림마다 「✕ 빼기」 — 원래 실린 그림은 숨김 기록, 더한 그림은 지움
   ─ 자료: Supabase public.note_images (auth/note_images.sql) · 파일은 비공개 보관함 gallery/notes/…
   ─ 읽기는 승인 회원, 쓰기는 관리자만 (Supabase 규칙) */
import { sb, myProfile } from "../../auth/auth.js";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let ADMIN = null;
async function isAdmin() {
  if (ADMIN === null) {
    try { const p = await myProfile(); ADMIN = !!(p && p.is_admin); } catch (e) { ADMIN = false; }
  }
  return ADMIN;
}
async function rowsOf(kind, id) {
  try {
    const r = await sb.from("note_images").select("*").eq("kind", kind).eq("note_id", id).order("sort").order("created_at");
    return r.error ? [] : (r.data || []);
  } catch (e) { return []; }
}
async function signedUrl(path) {
  try {
    const r = await sb.storage.from("gallery").createSignedUrl(path, 60 * 60 * 4);
    return (r.data && r.data.signedUrl) || "";
  } catch (e) { return ""; }
}

/* 항목 나누기 — 본문 바로 아래의 h4 마다 하나의 항목 (s1, s2 …) */
function sections(body) {
  const kids = [...body.children];
  const out = [];
  kids.forEach((el) => {
    if (el.tagName === "H4") out.push({ h: el, key: "s" + (out.length + 1), els: [] });
    else if (out.length) out[out.length - 1].els.push(el);
  });
  return out;
}

export async function decorate(det, kind, id) {
  const body = det && det.querySelector(".an__body");
  if (!body || body.dataset.ni) return;
  body.dataset.ni = "1";
  const [admin, rows] = await Promise.all([isAdmin(), rowsOf(kind, id)]);
  const hidden = new Set(rows.filter((r) => r.action === "hide").map((r) => r.url));
  const secs = sections(body);

  for (const s of secs) {
    s.h.dataset.sec = s.key;
    /* ① 원래 실린 그림 — 뺀 것은 숨기고, 관리자에게 「✕ 빼기」 */
    s.els.forEach((el) => el.querySelectorAll("figure").forEach((fig) => {
      const img = fig.querySelector("img");
      const src = img && img.getAttribute("src");
      if (!src) return;
      if (hidden.has(src)) { fig.remove(); return; }
      if (admin) addX(fig, async () => {
        if (!confirm("이 그림을 노트에서 뺄까요? (원래 자료는 그대로 두고 숨기기만 합니다)")) return;
        const r = await sb.from("note_images").insert({ kind, note_id: id, section: s.key, action: "hide", url: src });
        if (r.error) return alert("빼지 못했습니다: " + r.error.message);
        fig.remove();
      });
    }));
    /* ② 더한 그림 */
    const mine = rows.filter((r) => r.action === "add" && r.section === s.key);
    const grid = document.createElement("div");
    grid.className = "ab__figs ni__grid";
    s.h.insertAdjacentElement("afterend", grid);
    for (const r of mine) grid.appendChild(await figOf(r, admin, kind, id));
    /* ③ 관리자 — 「＋ 이미지」 */
    if (admin) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ni__add"; b.textContent = "＋ 이미지";
      b.title = "이 항목에 그림 더하기 — 파일 · 붙여넣기 · 인터넷 그림 주소";
      b.addEventListener("click", (e) => { e.preventDefault(); openForm(s, grid, kind, id); });
      s.h.appendChild(b);
    }
  }
}

function addX(fig, onClick) {
  if (fig.querySelector(".ni__x")) return;
  const x = document.createElement("button");
  x.type = "button"; x.className = "ni__x"; x.textContent = "✕ 빼기";
  x.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
  fig.classList.add("ni__fig");
  fig.appendChild(x);
}

async function figOf(r, admin, kind, id) {
  const fig = document.createElement("figure");
  fig.className = "ab__fig ni__mine";
  const src = r.storage_path ? await signedUrl(r.storage_path) : r.url;
  const link = r.source || src;
  let host = "";
  try { host = r.source ? new URL(r.source).hostname.replace(/^www\./, "") : (r.storage_path ? "직접 올림" : new URL(r.url).hostname.replace(/^www\./, "")); } catch (e) {}
  fig.innerHTML = `<a href="${esc(link)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(r.caption || "")}" loading="lazy" referrerpolicy="no-referrer"></a>` +
    `<figcaption>${r.caption ? `<b>${esc(r.caption)}</b> · ` : ""}${host ? `출처 ${r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noopener">${esc(host)} ↗</a>` : esc(host)}` : ""}</figcaption>`;
  if (admin) addX(fig, async () => {
    if (!confirm("더한 그림을 지울까요?")) return;
    const d = await sb.from("note_images").delete().eq("id", r.id);
    if (d.error) return alert("지우지 못했습니다: " + d.error.message);
    if (r.storage_path) { try { await sb.storage.from("gallery").remove([r.storage_path]); } catch (e) {} }
    fig.remove();
  });
  return fig;
}

/* 더하기 양식 — 파일(여러 장) · 끌어다 놓기 · 붙여넣기 · 인터넷 그림 주소 */
function openForm(s, grid, kind, id) {
  const old = s.h.parentElement.querySelector(`.ni__form[data-sec="${s.key}"]`);
  if (old) { old.remove(); return; }
  const f = document.createElement("div");
  f.className = "ni__form"; f.dataset.sec = s.key;
  f.innerHTML = `
    <label class="ni__drop" tabindex="0">파일을 고르거나 끌어다 놓거나, 여기를 누른 뒤 <b>Ctrl+V</b> 로 붙여넣기
      <input type="file" accept="image/*" multiple hidden></label>
    <input type="url" class="ni__url" placeholder="또는 인터넷 그림 주소 (https://…/그림.jpg — 그림에서 마우스 오른쪽 → 이미지 주소 복사)">
    <input type="text" class="ni__cap" maxlength="120" placeholder="설명 (예: 2층 평면도)">
    <input type="url" class="ni__src" placeholder="출처 페이지 주소 (선택)">
    <p class="ni__msg"></p>
    <div class="ni__btns"><button type="button" class="ni__go">더하기</button><button type="button" class="ni__cancel">닫기</button></div>`;
  grid.insertAdjacentElement("beforebegin", f);
  const files = [];
  const msg = f.querySelector(".ni__msg");
  const drop = f.querySelector(".ni__drop");
  const pick = f.querySelector("input[type=file]");
  const note = () => (msg.textContent = files.length ? `그림 ${files.length}장 준비됨` : "");
  const take = (list) => { [...list].filter((x) => x && x.type && x.type.startsWith("image/")).forEach((x) => files.push(x)); note(); };
  pick.addEventListener("change", () => take(pick.files));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("on"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("on"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("on"); take(e.dataTransfer.files); });
  f.addEventListener("paste", (e) => {
    const cd = e.clipboardData; if (!cd) return;
    const got = [...(cd.files || [])];
    [...(cd.items || [])].forEach((it) => { if (it.kind === "file") got.push(it.getAsFile()); });
    if (got.length) { e.preventDefault(); take(got); }
  });
  f.querySelector(".ni__cancel").addEventListener("click", () => f.remove());
  f.querySelector(".ni__go").addEventListener("click", async () => {
    const url = f.querySelector(".ni__url").value.trim();
    const caption = f.querySelector(".ni__cap").value.trim();
    const source = f.querySelector(".ni__src").value.trim();
    if (!files.length && !url) { msg.textContent = "파일을 고르거나 그림 주소를 넣어 주세요."; return; }
    const go = f.querySelector(".ni__go"); go.disabled = true;
    try {
      const add = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const path = `notes/${kind}/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        msg.textContent = "올리는 중…";
        const up = await sb.storage.from("gallery").upload(path, file, { cacheControl: "3600" });
        if (up.error) throw up.error;
        add.push({ kind, note_id: id, section: s.key, action: "add", storage_path: path, caption, source });
      }
      if (url) add.push({ kind, note_id: id, section: s.key, action: "add", url, caption, source });
      const r = await sb.from("note_images").insert(add).select();
      if (r.error) throw r.error;
      for (const row of r.data || []) grid.appendChild(await figOf(row, true, kind, id));
      f.remove();
    } catch (e) {
      msg.textContent = "더하지 못했습니다: " + (e.message || e) +
        (String(e.message || "").includes("note_images") ? " — Supabase 에 auth/note_images.sql 을 먼저 실행해 주세요." : "");
      go.disabled = false;
    }
  });
  drop.focus();
}
