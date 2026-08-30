// ─── Sites — 자주 드나드는 곳 ───────────────────────────────
//
//  갈래로 묶어 두고, 눌러서 바로 갑니다.
//  자료는 Supabase 의 sites 표에 쌓입니다 (auth/sites_setup.sql).
//  관리자만 보고 씁니다.
import { sb, currentUser, myProfile } from "../../auth/auth.js";

export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];

/** 갈래 — 브라우저 즐겨찾기의 폴더처럼 씁니다 */
export const SITE_CATS = [
  ["work",   "업무",     "#4f9d92"],
  ["data",   "자료·통계", "#2a5fa8"],
  ["edu",    "교육",     "#8a6bb0"],
  ["gri",    "GRI",     "#b3543b"],
  ["assoc",  "학회·단체", "#c98a3f"],
  ["life",   "생활",     "#5c9e4a"],
  ["etc",    "ETC",     "#7d7768"],
];
export const SC_NAME  = Object.fromEntries(SITE_CATS.map(([k, v]) => [k, v]));
export const SC_COLOR = Object.fromEntries(SITE_CATS.map(([k, , c]) => [k, c]));

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 주소에서 보기 좋은 이름만 뽑습니다 — https://www.gri.re.kr/… → gri.re.kr */
export function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch (e) { return String(u || "").replace(/^https?:\/\//, "").split("/")[0]; }
}
/** 붙여넣은 주소에 http 가 없으면 붙여 줍니다 */
export function fixUrl(u) {
  const t = String(u || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : "https://" + t;
}

function friendly(m) {
  m = String(m || "");
  if (/schema cache|does not exist|relation/i.test(m))
    return "아직 켜지지 않았습니다 — auth/sites_setup.sql 을 한 번 실행해주세요.";
  if (/row-level security|policy|permission/i.test(m))
    return "권한이 없습니다. 관리자만 쓸 수 있습니다.";
  return m;
}


export async function initSites(mountId = "sitesapp", sectionId = "sitesec") {
  const mount = document.getElementById(mountId);
  if (!mount) return false;
  const section = document.getElementById(sectionId);

  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;
  if (!isAdmin) { if (section) section.remove(); else mount.remove(); return false; }

  let rows = [], cur = "all", editing = null;

  mount.innerHTML =
    '<nav class="ntabs" id="stTabs"></nav>' +
    '<div class="nbar">' +
      '<label class="nsearch"><span class="sr-only">찾기</span>' +
        '<input type="search" id="stQ" placeholder="이름 · 주소 · 메모로 찾기" autocomplete="off"></label>' +
      '<button type="button" class="nbtn nbtn--go" id="stNew">＋ 새 사이트</button>' +
    "</div>" +
    '<p class="ncount" id="stCount"></p>' +
    '<div class="sgrid" id="stList"></div>' +
    '<p class="nempty" id="stEmpty" hidden></p>' +
    '<div class="nmodal" id="stModal" role="dialog" aria-modal="true" aria-label="사이트">' +
      '<div class="nmodal__box">' +
        '<h3 id="stTitle">새 사이트</h3>' +
        '<label for="stN">이름</label>' +
        '<input type="text" id="stN" maxlength="80" placeholder="예: 경기연구원">' +
        '<label for="stU">주소</label>' +
        '<input type="text" id="stU" maxlength="400" placeholder="gri.re.kr — http 는 없어도 됩니다">' +
        '<div class="nfrow nfrow--2">' +
          '<div><label for="stC">갈래</label><select id="stC"></select></div>' +
          '<div><label for="stM">메모</label>' +
            '<input type="text" id="stM" maxlength="120" placeholder="무엇에 쓰는 곳인지"></div>' +
        "</div>" +
        '<p class="nmsg" id="stMsg"></p>' +
        '<div class="nmodal__foot">' +
          '<button type="button" class="nbtn nbtn--del" id="stDel" hidden>지우기</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="nbtn" id="stCancel">취소</button>' +
          '<button type="button" class="nbtn nbtn--go" id="stSave">저장</button>' +
        "</div>" +
      "</div>" +
    "</div>";

  const q = document.getElementById("stQ");
  const tabs = document.getElementById("stTabs");
  const list = document.getElementById("stList");
  const countEl = document.getElementById("stCount");
  const emptyEl = document.getElementById("stEmpty");
  const modal = document.getElementById("stModal");
  const msg = document.getElementById("stMsg");
  const mC = document.getElementById("stC");
  mC.innerHTML = SITE_CATS.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");

  const match = (r) => {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    return [r.title, r.url, r.note, SC_NAME[r.category]].join(" ").toLowerCase().includes(s);
  };
  const shown = () => rows.filter((r) => cur === "all" || r.category === cur).filter(match);

  async function load() {
    const r = await sb.from("sites").select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (r.error) {
      mount.innerHTML = '<p class="nempty">' + esc(friendly(r.error.message)) + "</p>";
      return;
    }
    rows = r.data || [];
    draw();
  }

  function draw() {
    const mk = (k, label) => {
      const n = (k === "all" ? rows : rows.filter((r) => r.category === k)).filter(match).length;
      return `<button type="button" data-k="${k}"${k === cur ? ' class="on"' : ""}>` +
             `${esc(label)}<span class="n">${n}</span></button>`;
    };
    tabs.innerHTML = mk("all", "전체") + SITE_CATS.map(([k, v]) => mk(k, v)).join("");
    tabs.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { cur = b.dataset.k; draw(); }));

    const l = shown();
    countEl.textContent = `${cur === "all" ? "전체" : SC_NAME[cur]} ${l.length}곳` +
      (rows.length !== l.length ? ` · 모두 ${rows.length}곳` : "");

    emptyEl.hidden = !!l.length;
    if (!l.length) {
      list.innerHTML = "";
      emptyEl.textContent = q.value.trim()
        ? "찾으시는 곳이 없습니다."
        : "아직 담아둔 곳이 없습니다. 「＋ 새 사이트」로 더해 보세요.";
      return;
    }

    list.innerHTML = l.map((r) =>
      '<div class="scard" data-id="' + r.id + '">' +
        `<a class="scard__go" href="${esc(r.url)}" target="_blank" rel="noopener">` +
          `<span class="ncat" style="--c:${SC_COLOR[r.category] || "#888"}">` +
            `${esc(SC_NAME[r.category] || r.category)}</span>` +
          `<b>${esc(r.title)}</b>` +
          `<span class="scard__host">${esc(host(r.url))}</span>` +
          (r.note ? `<span class="scard__note">${esc(r.note)}</span>` : "") +
        "</a>" +
        '<button type="button" class="scard__edit" title="고치기" aria-label="고치기">✎</button>' +
      "</div>").join("");

    list.querySelectorAll(".scard__edit").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        open(rows.find((x) => x.id === b.closest(".scard").dataset.id));
      }));
  }

  function open(row) {
    editing = row || null;
    document.getElementById("stTitle").textContent = row ? "사이트 고치기" : "새 사이트";
    document.getElementById("stDel").hidden = !row;
    document.getElementById("stN").value = row ? row.title || "" : "";
    document.getElementById("stU").value = row ? row.url || "" : "";
    document.getElementById("stM").value = row ? row.note || "" : "";
    mC.value = row ? row.category : (cur === "all" ? "work" : cur);
    msg.textContent = "";
    modal.classList.add("on");
    document.getElementById("stN").focus();
  }
  const close = () => modal.classList.remove("on");
  document.getElementById("stNew").addEventListener("click", () => open(null));
  document.getElementById("stCancel").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("on")) close();
  });

  document.getElementById("stSave").addEventListener("click", async (e) => {
    const title = document.getElementById("stN").value.trim();
    const url = fixUrl(document.getElementById("stU").value);
    if (!title) { msg.textContent = "이름을 적어주세요."; return; }
    if (!url) { msg.textContent = "주소를 적어주세요."; return; }

    const patch = {
      title, url,
      category: mC.value,
      note: document.getElementById("stM").value.trim() || null,
    };
    e.target.disabled = true;
    msg.textContent = "저장하는 중…";
    try {
      const r = editing
        ? await sb.from("sites").update(patch).eq("id", editing.id)
        : await sb.from("sites").insert({ ...patch, created_by: user.id });
      if (r.error) { msg.textContent = friendly(r.error.message); return; }
      msg.textContent = "";
      close();
      await load();
    } catch (err) {
      msg.textContent = "저장하지 못했습니다 — " + friendly(err && err.message);
    } finally {
      e.target.disabled = false;
    }
  });

  document.getElementById("stDel").addEventListener("click", async () => {
    if (!editing) return;
    if (!confirm(`「${editing.title}」 을 지울까요?`)) return;
    const { error } = await sb.from("sites").delete().eq("id", editing.id);
    if (error) { msg.textContent = friendly(error.message); return; }
    close();
    await load();
  });

  q.addEventListener("input", draw);
  await load();
  return true;
}
