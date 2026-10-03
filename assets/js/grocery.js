// ─── To BUY 아래 「장본 것」 · 「이달의 제철」 · 「만들 수 있는 요리」 ───────────
//
//  「내가 <장보기> 폴더에 영수증과 사진을 찍어 올리면, 해당 날짜에서 유형별로
//    2주 정도 그 항목이 유지되어 볼 수 있게 … 과일 · 야채 · 다른 먹을 것 · ETC …
//    그 아래쪽에 이러한 메뉴로 만들어 먹을 수 있는 요리 이름 … Recipe 도 링크로」
//
//  · 「📂 장보기 폴더 읽기」 — 10.장보기 폴더(한 번 고르면 기억)의 그림을 이 브라우저에서
//    글자로 읽어(OCR) 영수증이면 품목을 뽑고, 아니면 그날의 사진으로 둡니다.
//    폴더의 「레시피.json」(손으로 적어 두신 요리 노트를 옮긴 것)도 함께 읽어 둡니다.
//  · 서버(groceries 표)에는 품목 글자 · 날짜 · 작은 미리보기만 갑니다. 그림 원본은 안 올립니다.
//  · 표가 아직 없으면(auth/tobuy_setup.sql 을 안 돌리셨으면) 이 브라우저에만 둡니다.
//  · 관리자만 봅니다 (To BUY 갈래가 관리자 것).
import { sb, currentUser } from "../../auth/auth.js";
import * as G from "./grocery-parse.js?v=202610040300";
import * as FK from "./fs-keep.js?v=202609250900";
import { fromImage } from "./notes-files.js?v=202610040300";

const LS = "skyish-groceries";
const IMG = /\.(jpe?g|png|webp)$/i;
const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const noTable = (e) => !!e && /does not exist|relation|schema cache|42P01|Could not find the table/i
  .test(String(e.message || e.details || e.hint || ""));

export async function initGrocery(mountId = "groapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return false;
  const user = await currentUser();
  if (!user) { mount.remove(); return false; }

  let rows = [], local = false, busy = false;
  let view = "";                       // 열어 둔 레시피 (요리 이름)

  /* ── 저장소 ── */
  const readLS = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (e) { return []; } };
  const writeLS = () => { try { localStorage.setItem(LS, JSON.stringify(rows)); } catch (e) {} };
  async function load() {
    const lo = new Date(); lo.setDate(lo.getDate() - 60);
    const r = await sb.from("groceries").select("*")
      .or("kind.eq.book,bought_on.gte." + lo.toISOString().slice(0, 10))
      .order("bought_on", { ascending: false });
    if (r.error) {
      if (!noTable(r.error)) throw r.error;
      local = true; rows = readLS(); return;
    }
    local = false; rows = r.data || [];
  }
  async function add(list) {
    if (!list.length) return;
    if (local) {
      list.forEach((x) => rows.push(Object.assign({ id: "l" + Date.now() + Math.random().toString(36).slice(2, 7) }, x)));
      writeLS(); return;
    }
    const r = await sb.from("groceries").insert(list.map((x) => Object.assign({ created_by: user.id }, x))).select();
    if (r.error) throw r.error;
    rows = rows.concat(r.data || []);
  }
  async function patch(id, p) {
    const x = rows.find((r) => r.id === id);
    if (x) Object.assign(x, p);
    if (local) { writeLS(); return; }
    const r = await sb.from("groceries").update(p).eq("id", id);
    if (r.error) throw r.error;
  }
  async function remove(ids) {
    rows = rows.filter((r) => ids.indexOf(r.id) < 0);
    if (local) { writeLS(); return; }
    if (!ids.length) return;
    const r = await sb.from("groceries").delete().in("id", ids);
    if (r.error) throw r.error;
  }

  const book = () => {
    const b = rows.find((r) => r.kind === "book");
    return (b && b.data) || null;
  };

  /* ── 화면 ── */
  mount.innerHTML =
    '<div class="gro">' +
      '<div class="gro__bar">' +
        '<button type="button" class="nbtn nbtn--go" id="groRead" title="10.장보기 폴더의 영수증·사진·레시피를 읽습니다 (Shift 를 누른 채 누르면 폴더를 새로 고릅니다)">📂 장보기 폴더 읽기</button>' +
        '<form class="gro__add" id="groAdd" autocomplete="off">' +
          '<input type="text" id="groName" placeholder="직접 넣기 — 산 것" aria-label="산 것">' +
          '<input type="date" id="groDate" aria-label="산 날">' +
          '<button type="submit" class="nbtn">＋</button>' +
        "</form>" +
      "</div>" +
      '<p class="gro__msg" id="groMsg" hidden></p>' +
      '<h3 class="gro__h">장본 것 <small>— 산 날로부터 2주</small></h3>' +
      '<div class="gro__cols" id="groCols"></div>' +
      '<div class="gro__pics" id="groPics"></div>' +
      '<h3 class="gro__h" id="groSeasonH">이달의 제철</h3>' +
      '<div class="gro__season" id="groSeason"></div>' +
      '<h3 class="gro__h">만들 수 있는 요리 <small>— 장본 것으로</small></h3>' +
      '<ol class="gro__dish" id="groDish"></ol>' +
      '<details class="gro__book" id="groBook"><summary>📖 내 요리책 전체</summary>' +
        '<input type="search" id="groBookQ" placeholder="요리·재료로 찾기" aria-label="요리책 찾기">' +
        '<ul id="groBookList"></ul></details>' +
      '<div class="gro__modal" id="groModal" hidden></div>' +
    "</div>";
  const $ = (id) => document.getElementById(id);
  $("groDate").value = today();
  const say = (t) => { const m = $("groMsg"); m.hidden = !t; m.innerHTML = t || ""; };

  function recipeHtml(r) {
    return '<div class="gro__card" role="dialog" aria-label="레시피">' +
      "<b>" + esc(r.n) + "</b>" +
      '<ol class="gro__steps">' + (r.lines || []).map((l) => "<li>" + esc(l) + "</li>").join("") + "</ol>" +
      '<p class="gro__src">' + esc(r.src || "") + " · " +
        '<a href="' + esc(G.recipeUrl(r.n.replace(/^(천상현|어남선생|백종원|이정현)\s*/, ""))) + '" target="_blank" rel="noopener">만개의레시피에서 더 보기 ↗</a></p>' +
      '<button type="button" class="nbtn" data-close="1">닫기</button></div>';
  }
  function openRecipe(name) {
    const b = book();
    const r = b && (b.recipes || []).find((x) => x.n === name);
    if (!r) return;
    const m = $("groModal");
    m.innerHTML = recipeHtml(r);
    m.hidden = false;
  }
  $("groModal").addEventListener("click", (e) => {
    if (e.target.id === "groModal" || e.target.closest("[data-close]")) $("groModal").hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("groModal").hidden = true; });

  function render() {
    const t = today();
    const items = rows.filter((r) => r.kind === "item" && G.within(r.bought_on, t));
    /* 갈래별 네 칸 */
    $("groCols").innerHTML = G.KINDS.map((k) => {
      const list = items.filter((x) => (x.cat || "etc") === k.k)
        .sort((a, b) => (b.bought_on || "").localeCompare(a.bought_on || "") || a.name.localeCompare(b.name));
      return '<section class="gro__col gro__col--' + k.k + '"><h4>' + esc(k.name) + " <small>" + list.length + "</small></h4>" +
        (list.length ? "<ul>" + list.map((x) =>
          '<li data-id="' + esc(x.id) + '"><span class="gro__n" title="눌러서 이름 고치기 (영수증 글자가 틀렸을 때)">' + esc(x.name) + "</span>" +
          '<span class="gro__d">' + esc((x.bought_on || "").slice(5).replace("-", ".")) + "</span>" +
          '<select class="gro__cat" aria-label="갈래 바꾸기">' + G.KINDS.map((o) =>
            '<option value="' + o.k + '"' + (o.k === (x.cat || "etc") ? " selected" : "") + ">" + esc(o.name) + "</option>").join("") +
          "</select>" +
          '<button type="button" class="gro__x" title="지우기">✕</button></li>').join("") + "</ul>"
        : '<p class="gro__none">—</p>') + "</section>";
    }).join("");

    /* 그날의 사진 */
    const pics = rows.filter((r) => r.kind === "photo" && r.thumb && G.within(r.bought_on, t));
    $("groPics").innerHTML = pics.map((p) =>
      '<figure data-src="' + esc(p.src || "") + '"><button type="button" class="gro__px" title="이 사진(영수증)과 거기서 읽은 품목을 지웁니다 — 「장보기 폴더 읽기」 를 누르면 다시 읽습니다">✕</button>' +
      '<img src="' + esc(p.thumb) + '" alt="' + esc(p.name || "") + '" loading="lazy">' +
      "<figcaption>" + esc((p.bought_on || "").slice(5).replace("-", ".")) +
      (p.data && p.data.receipt ? " · 영수증" : "") + "</figcaption></figure>").join("");

    /* 이달의 제철 — 요리 노트 첫 쪽의 표 */
    const b = book();
    const mon = new Date().getMonth() + 1;
    const se = b && b.season && b.season[String(mon)];
    $("groSeasonH").textContent = "이달의 제철 (" + mon + "월)";
    $("groSeason").innerHTML = se
      ? [["채소", se.veg], ["과일", se.fruit], ["해산물", se.sea], ["생선", se.fish]]
          .filter((x) => x[1] && x[1].length)
          .map((x) => "<p><b>" + x[0] + "</b> " + x[1].map((w) => "<span>" + esc(w) + "</span>").join("") + "</p>").join("")
      : '<p class="gro__none">「📂 장보기 폴더 읽기」 를 한 번 누르시면 요리 노트의 제철 표가 들어옵니다.</p>';

    /* 만들 수 있는 요리 — 내 요리책 먼저, 그다음 일반 요리 */
    const names = items.filter((x) => x.cat !== "etc").map((x) => x.name);
    const mine = b ? G.suggestBook(b.recipes || [], names) : [];
    const mineSet = new Set(mine.map((x) => x.dish));
    const more = G.suggest(names).filter((x) => !mineSet.has(x.dish)).slice(0, 8);
    $("groDish").innerHTML = (mine.length || more.length)
      ? mine.map((d) =>
          '<li><button type="button" class="gro__r" data-r="' + esc(d.dish) + '">📖 ' + esc(d.dish) + "</button>" +
          '<span class="gro__uses">' + esc(d.uses.join(" · ")) + "</span>" +
          (d.missing.length ? '<span class="gro__miss">더 있으면: ' + esc(d.missing.slice(0, 4).join(" · ")) + "</span>" : "") +
          '<a class="gro__ext" href="' + esc(d.url) + '" target="_blank" rel="noopener">Recipe ↗</a></li>').join("") +
        more.map((d) =>
          "<li><b>" + esc(d.dish) + "</b>" +
          '<span class="gro__uses">' + esc(d.uses.join(" · ")) + "</span>" +
          '<a class="gro__ext" href="' + esc(d.url) + '" target="_blank" rel="noopener">Recipe ↗</a></li>').join("")
      : '<li class="gro__none">장본 것이 들어오면 여기에 만들 수 있는 요리가 나옵니다.</li>';

    renderBook();
    if (local) say("지금은 <b>이 브라우저에만</b> 저장됩니다 (groceries 표가 아직 없습니다). " +
      "다른 기기에서도 보시려면 Supabase → SQL Editor 에서 <code>auth/tobuy_setup.sql</code> 을 한 번 돌려 주세요.");
  }

  function renderBook() {
    const b = book();
    const q = ($("groBookQ").value || "").trim();
    const list = ((b && b.recipes) || []).filter((r) => !q ||
      (r.n + " " + (r.lines || []).join(" ")).indexOf(q) >= 0);
    $("groBook").hidden = !b;
    $("groBookList").innerHTML = list.map((r) =>
      '<li><button type="button" class="gro__r" data-r="' + esc(r.n) + '">' + esc(r.n) + "</button></li>").join("");
  }
  $("groBookQ").addEventListener("input", renderBook);

  mount.addEventListener("click", async (e) => {
    const r = e.target.closest(".gro__r");
    if (r) { openRecipe(r.dataset.r); return; }
    /* 이름 고치기 — OCR 이 틀린 글자를 바로잡으면 갈래도 다시 매깁니다 */
    const nm = e.target.closest(".gro__n");
    if (nm) {
      const id = nm.closest("li").dataset.id;
      const cur = rows.find((r) => r.id === id);
      const v = prompt("품목 이름을 고쳐 주세요", cur ? cur.name : "");
      if (v == null || !v.trim() || !cur || v.trim() === cur.name) return;
      try { await patch(id, { name: v.trim(), cat: G.classify(v.trim()) }); render(); }
      catch (err) { alert("고치지 못했습니다 — " + err.message); }
      return;
    }
    const px = e.target.closest(".gro__px");
    if (px) {
      const src = px.closest("figure").dataset.src;
      if (!src || !confirm("이 사진과 거기서 읽은 품목을 지울까요?
「📂 장보기 폴더 읽기」 를 누르면 다시 읽습니다.")) return;
      const ids = rows.filter((r) => r.src === src || String(r.src || "").startsWith(src + "#")).map((r) => r.id);
      try { await remove(ids); render(); } catch (err) { alert("지우지 못했습니다 — " + err.message); }
      return;
    }
    const x = e.target.closest(".gro__x");
    if (x) {
      const id = x.closest("li").dataset.id;
      try { await remove([id]); render(); } catch (err) { alert("지우지 못했습니다 — " + err.message); }
    }
  });
  mount.addEventListener("change", async (e) => {
    const s = e.target.closest(".gro__cat");
    if (!s) return;
    try { await patch(s.closest("li").dataset.id, { cat: s.value }); render(); }
    catch (err) { alert("바꾸지 못했습니다 — " + err.message); }
  });
  $("groAdd").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("groName").value.trim();
    if (!name) return;
    try {
      await add([{ kind: "item", name, cat: G.classify(name), bought_on: $("groDate").value || today(), src: "직접" }]);
      $("groName").value = "";
      render();
    } catch (err) { alert("넣지 못했습니다 — " + err.message); }
  });

  /* ── 장보기 폴더 읽기 ── */
  /* 영수증 OCR 앞손질 — 사진 방향을 바로 세우고 긴 변을 2400 으로 (폰 사진 4000px · 캡처 1080px 모두)
     「영수증을 못 읽어서 … 글자가 깨진」 까닭은 크기·방향 그대로 넣고 쪽 나누기를 자동으로 둔 탓이었습니다 */
  async function forOcr(file) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const k = 2400 / Math.max(bmp.width, bmp.height);
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext("2d");
      g.drawImage(bmp, 0, 0, c.width, c.height);
      return c;
    } catch (e) { return file; }
  }
  async function thumb(file) {
    try {
      const bmp = await createImageBitmap(file);
      const k = 220 / Math.max(bmp.width, bmp.height);
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * Math.min(1, k)); c.height = Math.round(bmp.height * Math.min(1, k));
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.7);
    } catch (e) { return ""; }
  }
  async function walk(dir, path, out, depth) {
    for await (const h of dir.values()) {
      if (h.kind === "directory") { if (depth < 2) await walk(h, path + h.name + "/", out, depth + 1); continue; }
      out.push({ h, path: path + h.name, folder: path });
    }
  }

  $("groRead").addEventListener("click", async (ev) => {
    if (busy) return;
    if (typeof window.showDirectoryPicker !== "function") {
      alert("컴퓨터에서 쓰는 기능입니다 — 장보기 폴더가 컴퓨터에 있기 때문입니다."); return;
    }
    const got = await FK.pick("grocery", { mode: "read", id: "skyish-grocery", again: !!(ev && ev.shiftKey) });
    const dir = got && got.handle;
    if (!dir) return;
    busy = true;
    const btn = $("groRead"); btn.disabled = true;
    const done = { items: 0, receipts: 0, photos: 0, skipped: 0, book: 0 };
    try {
      const files = [];
      await walk(dir, "", files, 0);
      /* ① 요리책 — 「레시피.json」 */
      const bj = files.find((f) => /레시피\.json$/i.test(f.path));
      if (bj) {
        try {
          const data = JSON.parse(await (await bj.h.getFile()).text());
          await remove(rows.filter((r) => r.kind === "book").map((r) => r.id));
          await add([{ kind: "book", name: "요리책", src: bj.path, data }]);
          done.book = (data.recipes || []).length;
        } catch (e) { say("레시피.json 을 읽지 못했습니다 — " + esc(e.message)); }
      }
      /* ② 예전 읽개(v1)로 읽은 영수증은 지우고 다시 읽습니다 — 품목이 깨져 있었습니다 */
      const stale = rows.filter((r) => r.kind === "photo" && r.data && r.data.receipt && !(r.data.v >= 2)).map((r) => r.src);
      if (stale.length) await remove(rows.filter((r) => stale.some((k) => r.src === k || String(r.src || "").startsWith(k + "#"))).map((r) => r.id));
      /* ③ 그림 — 이미 읽은 것(이름·크기·날짜가 같은 것)은 건너뜁니다 */
      const seen = new Set(rows.map((r) => r.src).filter(Boolean));
      const pics = files.filter((f) => IMG.test(f.path));
      const heic = files.filter((f) => /\.(heic|heif)$/i.test(f.path)).length;
      const t = today();
      for (let i = 0; i < pics.length; i++) {
        const f = pics[i];
        const file = await f.h.getFile();
        const key = f.path + "|" + file.size + "|" + file.lastModified;
        if (seen.has(key)) continue;
        const md = new Date(file.lastModified);
        const fileDay = G.dateFrom(f.folder) || G.dateFrom(f.h.name) ||
          (md.getFullYear() + "-" + String(md.getMonth() + 1).padStart(2, "0") + "-" + String(md.getDate()).padStart(2, "0"));
        if (!G.within(fileDay, t, G.KEEP_DAYS + 7)) { done.skipped++; continue; }   // 오래된 것은 읽지 않습니다
        btn.textContent = "읽는 중… " + (i + 1) + "/" + pics.length;
        let lines = [];
        try { lines = await fromImage(await forOcr(file), (m) => say(esc(f.h.name) + " — " + esc(m)), { psm: 6 }); } catch (e) { lines = []; }
        const p = G.parseReceipt(lines);
        const isReceipt = G.looksLikeReceipt(lines, p);
        const day = (isReceipt && p.date) || fileDay;
        const th = await thumb(file);
        if (isReceipt) {
          await add([{ kind: "photo", name: p.store || "영수증", bought_on: day, src: key, thumb: th,
                       data: { receipt: true, store: p.store, n: p.items.length, v: 2 } }].concat(
            p.items.map((it) => ({ kind: "item", name: it.name, price: it.price, cat: G.classify(it.name),
                                   bought_on: day, src: key + "#" + it.name }))));
          done.receipts++; done.items += p.items.length;
        } else {
          await add([{ kind: "photo", name: f.h.name, bought_on: day, src: key, thumb: th }]);
          done.photos++;
        }
        seen.add(key);
      }
      say("읽었습니다 — 영수증 " + done.receipts + "장(품목 " + done.items + "개) · 사진 " + done.photos + "장" +
          (done.book ? " · 요리책 " + done.book + "가지" : "") +
          (done.skipped ? " · 3주 넘은 그림 " + done.skipped + "장은 건너뜀" : "") +
          (heic ? " · HEIC 그림 " + heic + "장은 읽을 수 없어 건너뜀 (폰 설정에서 JPG 로 찍어 주세요)" : "") +
          ". 품목 갈래가 틀리면 옆의 고르개로 바꿔 주세요.");
    } catch (err) {
      say("읽다가 멈췄습니다 — " + esc(err && err.message));
    } finally {
      busy = false; btn.disabled = false; btn.textContent = "📂 장보기 폴더 읽기";
      render();
    }
  });

  try { await load(); }
  catch (err) { mount.innerHTML = '<p class="nempty">장본 것을 읽지 못했습니다 — ' + esc(err && err.message) + "</p>"; return true; }
  render();
  return true;
}
