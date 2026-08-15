// ─── GALLERY — 사진첩 ────────────────────────────────────────
// u-tokyo.kr 총동문회 갤러리의 짜임을 그대로 옮겨 왔습니다.
//   gallery.html  사진첩 목록 (갈래 단추 · 검색 · 격자)
//   album.html    사진첩 하나 열기 (사진 격자 · 크게 보기 · 올리기)
// 자료는 Supabase 의 gallery_albums · gallery_photos 표에 쌓입니다.
import { sb, currentUser, myProfile } from "../../auth/auth.js";

export const CATS = [
  ["urban",      "Urban"],
  ["arch",       "Architecture"],
  ["architects", "Architects"],
  ["house",      "House"],
  ["daily",      "Daily Life"],
  ["etc",        "ETC"],
];
export const CAT_NAME = Object.fromEntries(CATS);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const ymd = (d) => (d || "").toString().slice(0, 10).replace(/-/g, ".");

/** 손으로 적은 날짜를 받아 줍니다.
    2025.9.14 · 2025-09-14 · 2025/9/14 · 20250914 · 2025.9 · 2025 모두 됩니다.
    알아보지 못하면 null (날짜 없음) 을 돌려줍니다. */
function parseDate(s) {
  s = (s || "").trim();
  if (!s) return null;
  let y, m, d;
  const parts = s.split(/[^0-9]+/).filter(Boolean);
  if (parts.length >= 2) {
    // 2025.9.14 · 2025-9-14 · 2025/9/4 처럼 구분자가 있으면 그대로 나눕니다
    y = parts[0]; m = parts[1]; d = parts[2] || "1";
  } else {
    // 숫자만 이어 적으신 경우 — 길이로 판단합니다
    const n = parts[0] || "";
    if (n.length === 8) { y = n.slice(0, 4); m = n.slice(4, 6); d = n.slice(6, 8); }
    else if (n.length === 6) { y = n.slice(0, 4); m = n.slice(4, 6); d = "1"; }
    else if (n.length === 4) { y = n; m = "1"; d = "1"; }
    else return null;
  }
  y = parseInt(y, 10); m = parseInt(m, 10); d = parseInt(d, 10);
  if (!y || y < 1900 || y > 2200) return null;
  if (!m || m < 1 || m > 12) m = 1;
  if (!d || d < 1 || d > 31) d = 1;
  const pad = (x) => String(x).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 로그인·승인 상태 — 사진첩을 만들 수 있는 분인지 */
async function whoAmI() {
  const user = await currentUser();
  const me = user ? await myProfile() : null;
  return {
    user, me,
    canAdd: !!(me && (me.analysis_access || me.is_admin)),
    isAdmin: !!(me && me.is_admin),
  };
}

/** 사진첩과 사진을 한꺼번에 읽어 옵니다 */
async function loadAll() {
  const [al, ph] = await Promise.all([
    sb.from("gallery_albums").select("*"),
    sb.from("gallery_photos").select("*"),
  ]);
  if (al.error) throw al.error;
  const photos = ph.error ? [] : (ph.data || []);
  const byAlbum = new Map();
  photos.forEach((p) => {
    if (!byAlbum.has(p.album_id)) byAlbum.set(p.album_id, []);
    byAlbum.get(p.album_id).push(p);
  });
  for (const list of byAlbum.values()) {
    list.sort((a, b) => (a.sort - b.sort)
      || (a.created_at || "").localeCompare(b.created_at || ""));
  }
  const albums = (al.data || []).map((a) => {
    const ps = byAlbum.get(a.id) || [];
    return { ...a, photos: ps, cover: a.cover_url || (ps[0] && ps[0].image_url) || "" };
  });
  // 행사 날짜가 최신인 것부터. 날짜가 없으면 만든 때로.
  albums.sort((a, b) =>
    (b.event_date || b.created_at || "").localeCompare(a.event_date || a.created_at || ""));
  return albums;
}

/** 사진 한 장을 보관함에 올리고 공개 주소를 돌려줍니다 */
async function upload(file, catKey) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `gallery/${catKey}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb.storage.from("gallery").upload(path, file, { cacheControl: "3600" });
  if (up.error) throw up.error;
  return { url: sb.storage.from("gallery").getPublicUrl(path).data.publicUrl, path };
}

/** 붙여넣기(Ctrl+V) 로 들어온 사진을 모읍니다.
    · 화면을 캡처한 그림  → clipboardData.items 에 담깁니다
    · 탐색기에서 Ctrl+C 로 복사한 사진 파일 → clipboardData.files 에 담깁니다
    둘 다 살펴야 어느 쪽으로 넣으셔도 받아집니다. */
function clipboardImages(e) {
  const cd = e.clipboardData || window.clipboardData;
  if (!cd) return [];
  const out = [], seen = new Set();
  const add = (f) => {
    if (!f || !f.type || !f.type.startsWith("image/")) return;
    const key = f.name + "|" + f.size + "|" + f.type;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };
  [...(cd.files || [])].forEach(add);                    // 복사해 온 사진 파일
  [...(cd.items || [])].forEach((it) => {
    if (it.kind === "file") add(it.getAsFile());         // 캡처한 그림
  });
  return out;
}

/* ── 이름으로 주소 찾기 ────────────────────────────────────
   건물·장소 이름을 적으면 주소 후보를 찾아 줍니다. (지도와 같은 방식)
   한국 안에서만 찾고, 열쇠(API key)는 필요 없습니다. */
async function findAddress(q) {
  q = (q || "").trim();
  if (q.length < 2) return [];
  const pick = (o) => ({ label: o.label, addr: o.addr, lat: o.lat, lng: o.lng });

  // 1) Nominatim — 한국어 주소를 먼저 찾습니다 (도·시 → 구 → 길 → 번호 차례로)
  try {
    const u = "https://nominatim.openstreetmap.org/search?format=json&limit=6"
            + "&addressdetails=1&namedetails=1&accept-language=ko"
            + "&countrycodes=kr&q=" + encodeURIComponent(q);
    const j = await fetch(u, { headers: { Accept: "application/json" } }).then((r) => r.json());
    const out = (j || []).map((h) => {
      const a = h.address || {};
      const addr = [
        a.province || a.state || a.city,
        a.city && a.city !== a.state ? a.city : "",
        a.borough || a.county,
        a.city_district || a.district,
        a.road || a.pedestrian || a.neighbourhood || a.quarter,
        a.house_number,
      ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(" ");
      const nd = h.namedetails || {};
      return pick({
        label: nd["name:ko"] || nd.name || (h.display_name || "").split(",")[0],
        addr: addr || (h.display_name || "").replace(/, 대한민국$/, ""),
        lat: parseFloat(h.lat), lng: parseFloat(h.lon),
      });
    }).filter((x) => x.lat && x.lng && x.addr);
    if (out.length) return out;
  } catch (e) { /* 다음 방법으로 */ }

  // 2) Photon — 일부만 쳐도 찾아 줍니다 (한국어가 없으면 영어로 나올 수 있습니다)
  try {
    const u = "https://photon.komoot.io/api/?limit=6&lang=ko"
            + "&lat=37.5665&lon=126.9780&location_bias_scale=0.5&q=" + encodeURIComponent(q);
    const j = await fetch(u).then((r) => r.json());
    return (j.features || [])
      .filter((f) => (f.properties || {}).countrycode === "KR")
      .map((f) => {
        const p = f.properties || {}, c = (f.geometry || {}).coordinates || [];
        const addr = [p.state, p.county, p.city, p.district, p.street, p.housenumber]
                       .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(" ");
        return pick({ label: p.name || q, addr: addr || p.name || "", lat: c[1], lng: c[0] });
      })
      .filter((x) => x.lat && x.lng && x.addr);
  } catch (e) { return []; }
}

/** 이름칸에 적으면 주소 후보를 아래에 펼쳐 주는 장치를 붙입니다 */
function attachAddressFinder(nameEl, addrEl, sugEl) {
  let timer = null, last = "";
  const hide = () => { sugEl.classList.remove("on"); sugEl.innerHTML = ""; };

  async function look(q) {
    if (q === last) return;
    last = q;
    sugEl.innerHTML = '<div class="gsug__msg">주소를 찾는 중…</div>';
    sugEl.classList.add("on");
    const list = await findAddress(q);
    if (!list.length) {
      sugEl.innerHTML = '<div class="gsug__msg">찾지 못했습니다. 주소를 직접 적어주세요.</div>';
      return;
    }
    sugEl.innerHTML = list.map((h, i) =>
      `<button type="button" class="gsug__item" data-i="${i}">` +
      `<b>${esc(h.label)}</b><span>${esc(h.addr)}</span></button>`).join("");
    sugEl.querySelectorAll(".gsug__item").forEach((b) => b.addEventListener("click", () => {
      const h = list[+b.dataset.i];
      addrEl.value = h.addr;
      addrEl.dataset.lat = h.lat;
      addrEl.dataset.lng = h.lng;
      hide();
    }));
  }

  nameEl.addEventListener("input", () => {
    clearTimeout(timer);
    const q = nameEl.value.trim();
    if (q.length < 2) { hide(); return; }
    timer = setTimeout(() => look(q), 600);      // 타이핑이 멈추면 찾습니다
  });
  addrEl.addEventListener("input", () => {
    delete addrEl.dataset.lat; delete addrEl.dataset.lng;   // 직접 고치면 좌표는 버립니다
  });
  document.addEventListener("click", (e) => {
    if (!sugEl.contains(e.target) && e.target !== nameEl) hide();
  });
}

function friendly(m) {
  m = String(m || "");
  if (/schema cache|does not exist|relation/i.test(m))
    return "사진첩 기능이 아직 켜지지 않았습니다 — auth/gallery_setup.sql 을 한 번 실행해주세요.";
  if (/row-level security|policy/i.test(m))
    return "권한이 없습니다. 승인된 회원만 올릴 수 있습니다.";
  if (/Bucket not found/i.test(m))
    return "사진 보관함이 없습니다 — Storage 에서 gallery 보관함을 만들어주세요.";
  return m;
}

/* ══════════════════════════════════════════════════════════
   사진첩 목록 — gallery.html
   ══════════════════════════════════════════════════════════ */
export async function initGallery(mountId = "galapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  mount.innerHTML = `
    <div class="gsearch">
      <div class="gsearch__box">
        <input type="search" id="gq" autocomplete="off"
               placeholder="사진첩 이름 · 날짜로 찾기  (예: 답사, 2025)">
      </div>
      <button type="button" class="gsearch__go" id="gqGo">검색</button>
      <button type="button" class="gsearch__clr" id="gqClr">✕ 검색 해제</button>
    </div>
    <nav class="gtabs" id="gtabs" aria-label="사진첩 갈래"></nav>
    <div class="gbar">
      <p class="gcount" id="gcount"></p>
      <button type="button" class="gnew" id="gNew">＋ 사진첩 만들기</button>
    </div>
    <div class="ggrid" id="ggrid"></div>
    <p class="gempty" id="gempty" hidden></p>

    <div class="gmodal" id="gModal" role="dialog" aria-modal="true" aria-label="사진첩 만들기">
      <div class="gmodal__box">
        <h3>사진첩 만들기</h3>
        <p class="gmodal__sub">사진첩을 만들면 회원 누구나 그 안에 사진을 더 올릴 수 있습니다.</p>

        <label for="mCat">분류 <span class="req">*</span></label>
        <select id="mCat"></select>

        <label for="mTitle">사진첩 이름 <span class="req">*</span></label>
        <div class="gfield">
          <input type="text" id="mTitle" maxlength="80" autocomplete="off"
                 placeholder="예: 판교 스케일링 하우스 — 적으면 아래 주소를 찾아 드립니다">
          <div class="gsug" id="mSug"></div>
        </div>

        <label for="mAddr">주소</label>
        <input type="text" id="mAddr" maxlength="160" autocomplete="off"
               placeholder="이름을 적으면 자동으로 채워집니다 (직접 고치셔도 됩니다)">

        <label for="mFeat">건축특징</label>
        <textarea id="mFeat" maxlength="600" rows="3"
                  placeholder="설계자 · 준공연도 · 구조와 재료 · 눈여겨볼 점"></textarea>

        <label for="mDate">행사 날짜 <span class="req">*</span></label>
        <input type="text" id="mDate" maxlength="12" autocomplete="off"
               placeholder="2025.09.14  (연도만 적으셔도 됩니다)">

        <label>사진 <span class="opt">(지금 올리지 않고 나중에 추가해도 됩니다)</span></label>
        <label class="gdrop" id="mDrop">
          <b>사진 고르기 · 끌어다 놓기 · 붙여넣기(Ctrl+V)</b>
          <span id="mDropMsg">데스크탑 폴더에서 사진을 끌어다 놓으셔도 되고,
            캡처한 그림을 Ctrl+V 로 붙여넣으셔도 됩니다.</span>
          <input type="file" id="mFiles" accept="image/*" multiple hidden>
        </label>
        <div class="gthumbs" id="mThumbs"></div>

        <p class="gmodal__msg" id="mMsg"></p>
        <div class="gmodal__foot">
          <button type="button" class="gbtn" id="mCancel">취소</button>
          <button type="button" class="gbtn gbtn--dark" id="mGo">만들기</button>
        </div>
      </div>
    </div>`;

  const q      = document.getElementById("gq");
  const tabs   = document.getElementById("gtabs");
  const grid   = document.getElementById("ggrid");
  const empty  = document.getElementById("gempty");
  const countEl= document.getElementById("gcount");
  const clr    = document.getElementById("gqClr");

  let cur = new URLSearchParams(location.search).get("cat");
  if (!CAT_NAME[cur]) cur = "all";

  let albums = [];
  const { canAdd, isAdmin, user, me } = await whoAmI();
  document.getElementById("gNew").classList.toggle("on", canAdd);

  try {
    albums = await loadAll();
  } catch (e) {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.textContent = friendly(e.message);
    tabs.innerHTML = "";
    countEl.textContent = "";
    return;
  }

  function match(a) {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    return ((a.title || "") + " " + (a.event_date || "") + " " + (a.owner_name || ""))
      .toLowerCase().includes(s);
  }

  function drawTabs() {
    const all = albums.filter(match);
    const mk = (key, label) => {
      const n = key === "all" ? all.length : all.filter((a) => a.category === key).length;
      return `<a href="gallery.html${key === "all" ? "" : "?cat=" + key}" data-c="${key}"` +
             `${key === cur ? ' class="on" aria-current="page"' : ""}>` +
             `${esc(label)} <span class="gtabs__n">${n}</span></a>`;
    };
    tabs.innerHTML = mk("all", "전체") + CATS.map(([k, v]) => mk(k, v)).join("");
    tabs.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      cur = a.dataset.c;
      const p = new URLSearchParams(location.search);
      if (cur === "all") p.delete("cat"); else p.set("cat", cur);
      history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
      draw();
    }));
  }

  function draw() {
    drawTabs();
    const list = albums.filter((a) => (cur === "all" || a.category === cur) && match(a));
    const shots = list.reduce((n, a) => n + a.photos.length, 0);
    countEl.textContent =
      `${cur === "all" ? "전체" : CAT_NAME[cur]} · 사진첩 ${list.length}개 · 사진 ${shots}장 (최신순)`;
    clr.classList.toggle("on", !!q.value.trim());

    if (!list.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      empty.textContent = q.value.trim()
        ? "찾으시는 사진첩이 없습니다."
        : "이 갈래에는 아직 사진첩이 없습니다.";
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list.map((a) => `
      <a class="alb" href="album.html?a=${encodeURIComponent(a.id)}">
        <span class="alb__sq">${a.cover
          ? `<img src="${esc(a.cover)}" alt="${esc(a.title)}" loading="lazy">`
          : '<span class="alb__none">사진 없음</span>'}</span>
        <span class="alb__cp">
          <b>${esc(a.title)}</b>
          <small>${ymd(a.event_date) || ymd(a.created_at)} · 사진 ${a.photos.length}장</small>
        </span>
      </a>`).join("");
  }

  q.addEventListener("input", draw);
  document.getElementById("gqGo").addEventListener("click", draw);
  clr.addEventListener("click", () => { q.value = ""; draw(); });
  draw();

  /* ── 사진첩 만들기 ── */
  const modal = document.getElementById("gModal");
  const mCat = document.getElementById("mCat");
  mCat.innerHTML = CATS.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  if (CAT_NAME[cur]) mCat.value = cur;

  const mMsg = document.getElementById("mMsg");
  const mDate = document.getElementById("mDate");
  const thumbs = document.getElementById("mThumbs");
  const fileEl = document.getElementById("mFiles");
  const drop = document.getElementById("mDrop");

  /* 올릴 사진을 모아 둡니다 (고르기 · 끌어다 놓기 · 붙여넣기 모두 여기로) */
  let picked = [];
  function drawThumbs() {
    thumbs.innerHTML = picked.map((f, i) =>
      `<span class="gthumb"><img src="${URL.createObjectURL(f)}" alt="">` +
      `<button type="button" data-i="${i}" title="빼기">✕</button></span>`).join("");
    thumbs.querySelectorAll("button").forEach(b => b.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      picked.splice(+b.dataset.i, 1); drawThumbs();
    }));
    document.getElementById("mDropMsg").textContent = picked.length
      ? `사진 ${picked.length}장을 담았습니다. 더 넣으셔도 됩니다.`
      : "데스크탑 폴더에서 사진을 끌어다 놓으셔도 되고, 캡처한 그림을 Ctrl+V 로 붙여넣으셔도 됩니다.";
  }
  function addFiles(list) {
    const imgs = [...list].filter(f => f.type.startsWith("image/"));
    if (imgs.length) { picked = picked.concat(imgs); drawThumbs(); }
  }
  fileEl.addEventListener("change", () => { addFiles(fileEl.files); fileEl.value = ""; });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("over");
    addFiles(e.dataTransfer.files);
  });
  // 창이 열려 있을 때 Ctrl+V — 캡처한 그림도, 복사해 온 사진 파일도 받습니다
  document.addEventListener("paste", (e) => {
    if (!modal.classList.contains("on")) return;
    const imgs = clipboardImages(e);
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  });

  attachAddressFinder(document.getElementById("mTitle"),
                      document.getElementById("mAddr"),
                      document.getElementById("mSug"));

  document.getElementById("gNew").addEventListener("click", () => {
    mMsg.textContent = "";
    picked = []; drawThumbs();
    if (!mDate.value) {                    // 오늘 날짜를 미리 적어 둡니다 (고치셔도 됩니다)
      const t = new Date();
      mDate.value = `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, "0")}.` +
                    `${String(t.getDate()).padStart(2, "0")}`;
    }
    modal.classList.add("on");
    document.getElementById("mTitle").focus();
  });
  const closeModal = () => modal.classList.remove("on");
  document.getElementById("mCancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("on")) closeModal();
  });

  document.getElementById("mGo").addEventListener("click", async (e) => {
    const title = document.getElementById("mTitle").value.trim();
    if (!title) { mMsg.textContent = "사진첩 이름을 적어주세요."; return; }
    e.target.disabled = true;
    mMsg.textContent = "만드는 중…";
    const addrEl = document.getElementById("mAddr");
    const { data, error } = await sb.from("gallery_albums").insert({
      category: mCat.value,
      title,
      event_date: parseDate(mDate.value),
      address: addrEl.value.trim() || null,
      lat: addrEl.dataset.lat ? parseFloat(addrEl.dataset.lat) : null,
      lng: addrEl.dataset.lng ? parseFloat(addrEl.dataset.lng) : null,
      feature: document.getElementById("mFeat").value.trim() || null,
      owner_name: (me && me.is_admin) ? "" : ((me && me.name) || ""),
      owner_admin: !!(me && me.is_admin),
      created_by: user.id,
    }).select().single();
    if (error) { e.target.disabled = false; mMsg.textContent = friendly(error.message); return; }

    // 담아 두신 사진이 있으면 이어서 올립니다
    for (let i = 0; i < picked.length; i++) {
      mMsg.textContent = `사진 올리는 중… (${i + 1}/${picked.length})`;
      try {
        const { url, path } = await upload(picked[i], mCat.value);
        const r = await sb.from("gallery_photos").insert({
          album_id: data.id, image_url: url, storage_path: path, sort: i,
          owner_name: (me && me.is_admin) ? "" : ((me && me.name) || ""),
          created_by: user.id,
        });
        if (r.error) throw r.error;
      } catch (err) {
        mMsg.textContent = "사진 올리기 실패: " + friendly(err.message) +
                           " — 사진첩은 만들어졌습니다.";
        e.target.disabled = false;
        return;
      }
    }
    location.href = "album.html?a=" + encodeURIComponent(data.id);
  });
}

/* ══════════════════════════════════════════════════════════
   사진첩 하나 — album.html
   ══════════════════════════════════════════════════════════ */
export async function initAlbum(mountId = "albapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const id = new URLSearchParams(location.search).get("a");
  if (!id) { mount.innerHTML = '<p class="gempty">사진첩을 찾을 수 없습니다.</p>'; return; }

  const { canAdd, isAdmin, user, me } = await whoAmI();

  let album = null;
  try {
    const r = await sb.from("gallery_albums").select("*").eq("id", id).single();
    if (r.error) throw r.error;
    album = r.data;
  } catch (e) {
    mount.innerHTML = `<p class="gempty">${esc(friendly(e.message))}</p>`;
    return;
  }

  const mine = !!(user && album.created_by === user.id);
  const canEdit = mine || isAdmin;

  mount.innerHTML = `
    <p class="albback"><a href="gallery.html?cat=${esc(album.category)}">← ${esc(CAT_NAME[album.category] || "갤러리")}</a></p>
    <div class="albhead">
      <div>
        <h2 class="albhead__title">${esc(album.title)}</h2>
        <p class="albhead__meta">
          ${esc(CAT_NAME[album.category] || "")}
          ${album.event_date ? " · " + ymd(album.event_date) : ""}
          ${album.owner_name ? " · " + esc(album.owner_name) : ""}
          <span id="albn"></span>
        </p>
        ${album.address ? `<p class="albaddr">📍 ${esc(album.address)}
          ${album.lat && album.lng
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${album.lat},${album.lng}"
                  target="_blank" rel="noopener">지도에서 보기 →</a>` : ""}</p>` : ""}
        ${album.feature ? `<div class="albfeat">
          <span class="albfeat__lab">건축특징</span>
          <p>${esc(album.feature).replace(/\n/g, "<br>")}</p>
        </div>` : ""}
      </div>
      ${canEdit ? '<div class="albacts">' +
        '<button type="button" class="gbtn" id="albEdit">✎ 내용 고치기</button>' +
        '<button type="button" class="gbtn albdel" id="albDel">사진첩 지우기</button>' +
        "</div>" : ""}
    </div>
    ${canEdit ? `
    <div class="albedit" id="albEditBox" hidden>
      <label for="eTitle">이름</label>
      <div class="gfield">
        <input type="text" id="eTitle" maxlength="80" autocomplete="off">
        <div class="gsug" id="eSug"></div>
      </div>
      <label for="eAddr">주소</label>
      <input type="text" id="eAddr" maxlength="160" autocomplete="off"
             placeholder="이름을 고치면 주소를 다시 찾아 드립니다">
      <label for="eFeat">건축특징</label>
      <textarea id="eFeat" maxlength="600" rows="3"
                placeholder="설계자 · 준공연도 · 구조와 재료 · 눈여겨볼 점"></textarea>
      <label for="eCat">갈래</label>
      <select id="eCat">${CATS.map(([k, v]) =>
        `<option value="${k}"${k === album.category ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <label for="eDate">날짜</label>
      <input type="text" id="eDate" maxlength="12" autocomplete="off"
             placeholder="2025.09.14  (연도만 적으셔도 됩니다)">
      <div class="albedit__foot">
        <button type="button" class="gbtn" id="eCancel">그만두기</button>
        <button type="button" class="gbtn gbtn--dark" id="eSave">저장하기</button>
      </div>
      <p class="albedit__msg" id="eMsg"></p>
    </div>` : ""}
    ${canAdd ? `
    <label class="albdrop" id="albDrop">
      <b>＋ 사진 올리기</b>
      <span>여기에 붙여넣기(Ctrl+V) 하거나, 사진을 끌어다 놓으세요. 눌러서 고르셔도 됩니다.</span>
      <input type="file" id="albFile" accept="image/*" multiple hidden>
    </label>
    <p class="albmsg" id="albMsg"></p>` : ""}
    <div class="masonry" id="albGrid"></div>
    <p class="gempty" id="albEmpty" hidden>아직 사진이 없습니다.</p>`;

  const grid = document.getElementById("albGrid");
  const emptyEl = document.getElementById("albEmpty");
  const nEl = document.getElementById("albn");
  let photos = [];

  async function reload() {
    const r = await sb.from("gallery_photos").select("*").eq("album_id", id)
                      .order("sort", { ascending: true })
                      .order("created_at", { ascending: true });
    photos = r.data || [];
    nEl.textContent = " · 사진 " + photos.length + "장";
    emptyEl.hidden = photos.length > 0;
    grid.innerHTML = photos.map((p) => `
      <figure data-id="${p.id}">
        <img src="${esc(p.image_url)}" alt="${esc(p.caption || album.title)}" loading="lazy">
        ${(user && p.created_by === user.id) || isAdmin
          ? `<button class="albx" data-id="${p.id}" title="이 사진 지우기">✕</button>` : ""}
      </figure>`).join("");

    grid.querySelectorAll(".albx").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation(); e.preventDefault();
      if (!confirm("이 사진을 지울까요?")) return;
      const p = photos.find((x) => x.id === b.dataset.id);
      if (p && p.storage_path) await sb.storage.from("gallery").remove([p.storage_path]);
      const { error } = await sb.from("gallery_photos").delete().eq("id", b.dataset.id);
      if (error) { alert("지우기 실패: " + friendly(error.message)); return; }
      reload();
    }));
  }
  await reload();

  if (!canAdd) return;

  const msg = document.getElementById("albMsg");
  const fileEl = document.getElementById("albFile");
  const drop = document.getElementById("albDrop");

  async function addFiles(files) {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    let done = 0;
    for (const f of list) {
      msg.textContent = `올리는 중… (${done + 1}/${list.length})`;
      try {
        const { url, path } = await upload(f, album.category);
        const { error } = await sb.from("gallery_photos").insert({
          album_id: id, image_url: url, storage_path: path,
          sort: photos.length + done,
          owner_name: (me && me.is_admin) ? "" : ((me && me.name) || ""),
          created_by: user.id,
        });
        if (error) throw error;
        done++;
      } catch (e) {
        msg.textContent = "올리기 실패: " + friendly(e.message);
        await reload();
        return;
      }
    }
    msg.textContent = `사진 ${done}장을 올렸습니다.`;
    await reload();
  }

  fileEl.addEventListener("change", () => addFiles(fileEl.files));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("over");
    addFiles(e.dataTransfer.files);
  });
  document.addEventListener("paste", (e) => {
    const imgs = clipboardImages(e);
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  });

  /* ── 사진첩 내용 고치기 (이름 · 갈래 · 날짜) ── */
  const eBox = document.getElementById("albEditBox");
  if (eBox) {
    const eMsg = document.getElementById("eMsg");
    attachAddressFinder(document.getElementById("eTitle"),
                        document.getElementById("eAddr"),
                        document.getElementById("eSug"));
    const open = (on) => {
      eBox.hidden = !on;
      if (on) {
        document.getElementById("eTitle").value = album.title || "";
        document.getElementById("eAddr").value = album.address || "";
        document.getElementById("eFeat").value = album.feature || "";
        document.getElementById("eCat").value = album.category;
        document.getElementById("eDate").value = ymd(album.event_date);
        eMsg.textContent = "";
        document.getElementById("eTitle").focus();
      }
    };
    document.getElementById("albEdit").addEventListener("click", () => open(eBox.hidden));
    document.getElementById("eCancel").addEventListener("click", () => open(false));
    document.getElementById("eSave").addEventListener("click", async (ev) => {
      const title = document.getElementById("eTitle").value.trim();
      if (!title) { eMsg.textContent = "이름을 적어주세요."; return; }
      ev.target.disabled = true;
      eMsg.textContent = "저장하는 중…";
      const ea = document.getElementById("eAddr");
      const patch = {
        title,
        category: document.getElementById("eCat").value,
        event_date: parseDate(document.getElementById("eDate").value),
        address: ea.value.trim() || null,
        feature: document.getElementById("eFeat").value.trim() || null,
      };
      // 후보에서 고르셨을 때만 좌표를 새로 넣습니다 (직접 적으신 주소는 좌표를 모릅니다)
      if (ea.dataset.lat) {
        patch.lat = parseFloat(ea.dataset.lat);
        patch.lng = parseFloat(ea.dataset.lng);
      }
      const { error } = await sb.from("gallery_albums").update(patch).eq("id", id);
      ev.target.disabled = false;
      if (error) { eMsg.textContent = friendly(error.message); return; }
      location.reload();
    });
  }

  const del = document.getElementById("albDel");
  if (del) del.addEventListener("click", async () => {
    if (!confirm(`「${album.title}」 사진첩을 통째로 지울까요?\n안의 사진도 함께 사라집니다.`)) return;
    const paths = photos.map((p) => p.storage_path).filter(Boolean);
    if (paths.length) await sb.storage.from("gallery").remove(paths);
    const { error } = await sb.from("gallery_albums").delete().eq("id", id);
    if (error) { alert("지우기 실패: " + friendly(error.message)); return; }
    location.href = "gallery.html?cat=" + album.category;
  });
}
