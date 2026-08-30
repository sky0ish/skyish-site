// ─── Sites — 자주 드나드는 곳 ───────────────────────────────
//
//  갈래로 묶어 두고, 눌러서 바로 갑니다.
//  자료는 Supabase 의 sites 표에 쌓입니다 (auth/sites_setup.sql).
//  관리자만 보고 씁니다.
import { sb, currentUser, myProfile } from "../../auth/auth.js";

export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];

/** 갈래 — 브라우저 즐겨찾기의 폴더처럼 씁니다 */
export const SITE_CATS = [
  ["learn",  "학습",     "#2f7d6f"],
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

/* ── 붙박이 ──
   SQL(auth/sites_setup.sql) 을 아직 안 돌리셨어도 이것만은 늘 보입니다.
   같은 주소가 표에 들어오면 그쪽을 씁니다 — 그래야 고치고 지울 수 있습니다. */
export const BUILTIN = [
  { title: "한솔아카데미", url: "https://bim.inup.co.kr/mypage/index.jsp?t=mypage",
    category: "learn", note: "건축 · BIM — 내 강의실" },
  { title: "패스트캠퍼스", url: "https://fastcampus.co.kr/me/course",
    category: "learn", note: "수강 중인 강의" },
  { title: "클래스101",   url: "https://class101.net/ko/my-classes",
    category: "learn", note: "내 클래스" },
  { title: "인프런",      url: "https://www.inflearn.com/my/courses",
    category: "learn", note: "내 학습" },
];

/* 각 사이트에서 받아 둔 마크 — 그때그때 바깥에 부르지 않고 여기 담아 씁니다.
   그래야 빠르고, 어디에 들렀는지 그 사이트에 알려지지도 않습니다. */
const LOGO = {
  "bim.inup.co.kr":   "hansol.png",
  "fastcampus.co.kr": "fastcampus.png",
  "class101.net":     "class101.png",
  "inflearn.com":     "inflearn.png",
};

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 주소에서 보기 좋은 이름만 뽑습니다 — https://www.gri.re.kr/… → gri.re.kr */
export function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch (e) { return String(u || "").replace(/^https?:\/\//, "").split("/")[0]; }
}
/** 그 사이트의 마크가 있으면 그 자리 */
export function logoOf(u) {
  const f = LOGO[host(u)];
  return f ? "assets/img/sites/" + f : "";
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

  let dbNote = "";        // 표 쪽에 문제가 있을 때 적어 두는 한 줄

  async function load() {
    const r = await sb.from("sites").select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    /* 표가 아직 없어도 화면을 지우지 않습니다.
       붙박이(학습 사이트)는 그대로 보이고, 사정만 한 줄 적어 둡니다. */
    dbNote = r.error ? friendly(r.error.message) : "";
    const db = r.error ? [] : (r.data || []);

    // 같은 주소가 표에 있으면 붙박이는 비켜 줍니다
    const trim = (u) => String(u || "").replace(/\/+$/, "");
    const have = new Set(db.map((x) => trim(x.url)));
    const extra = BUILTIN.filter((b) => !have.has(trim(b.url)))
      .map((b, i) => ({ ...b, id: "builtin-" + i, builtin: true }));

    const order = SITE_CATS.map(([k]) => k);
    rows = extra.concat(db).sort((a, b) =>
      order.indexOf(a.category) - order.indexOf(b.category) ||
      String(a.title).localeCompare(String(b.title), "ko"));
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

    list.innerHTML = (dbNote ? `<p class="snote">${esc(dbNote)}</p>` : "") +
      l.map((r) => {
      const logo = logoOf(r.url);
      return '<div class="scard' + (logo ? " scard--logo" : "") + '" data-id="' + r.id + '">' +
        `<a class="scard__go" href="${esc(r.url)}" target="_blank" rel="noopener">` +
          (logo
            ? `<img class="scard__mark" src="${esc(logo)}" alt="" width="44" height="44" ` +
              `loading="lazy" decoding="async">`
            : "") +
          '<span class="scard__txt">' +
            `<span class="ncat" style="--c:${SC_COLOR[r.category] || "#888"}">` +
              `${esc(SC_NAME[r.category] || r.category)}</span>` +
            `<b>${esc(r.title)}</b>` +
            `<span class="scard__host">${esc(host(r.url))}</span>` +
            (r.note ? `<span class="scard__note">${esc(r.note)}</span>` : "") +
          "</span>" +
        "</a>" +
        // 붙박이는 표에 없는 줄이라 고칠 수 없습니다
        (r.builtin ? ""
          : '<button type="button" class="scard__edit" title="고치기" aria-label="고치기">✎</button>') +
      "</div>";
    }).join("");

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
