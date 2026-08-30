// ─── 주소록 ────────────────────────────────────────────────
//
//  ※ 이 화면은 자료를 어디로도 보내지 않습니다.
//     내 컴퓨터의 엑셀을 브라우저가 직접 읽어 화면에만 그립니다.
//     GitHub 에도 Supabase 에도 한 글자도 올라가지 않습니다.
//     새로고침하면 사라지고, 다시 열려면 파일을 다시 고르면 됩니다.
//
//  읽는 것
//    00.주소록/개인명함첩_*.xlsx              리멤버 명함첩  (약 2,570명)
//    00.주소록/동경대 총동문회 주소록_*.xlsx   동문 명부     (약 1,310명)
//
//  두 파일의 「부서」는 뜻이 다릅니다 —
//    명함첩의 부서 = 다니는 회사의 팀,  동문 명부의 Department = 동경대 학부.
//    그래서 절대 한 칸에 합치지 않습니다.
import { currentUser, myProfile } from "../../auth/auth.js";

/** 주인 이메일 — 이 사람만 주소록을 봅니다 */
export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];

const XLSX_LIB = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
const PAGE = 200;                     // 한 번에 그리는 줄 수 (3,900명을 통째로 그리면 느립니다)
const NL = String.fromCharCode(10);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));


/* ── 동경대 전공 코드 → 한글 이름 ──
   코드는 명부의 4번째 칸(머리글이 비어 있는 영문 코드)에서 옵니다.
   16가지뿐이고 가장 적은 것도 12명이라 갈래로 쓰기 좋습니다. */
export const MAJORS = {
  AR:   "건축",
  CUE:  "도시·사회기반",
  EM:   "기계·전기",
  CM:   "화학·생명",
  EE:   "조선·해양",
  IN:   "정보",
  SC:   "이학",
  AG:   "농학·수의",
  MM:   "의학·약학",
  L:    "법학·정치",
  EC:   "경제",
  HS:   "인문사회",
  T:    "총합문화",
  LAB:  "연구소",
  ETC:  "기타",
  Z_N:  "미분류",
};


/* ── 명함을 갈래로 나누기 ──
   명함첩에는 「그룹」 칸이 있지만 12%만 채워져 있어 쓸 수 없습니다.
   그래서 회사 이름과 직함을 보고 갈라냅니다.
   (실제 2,569장으로 재보니 공무원 538 · 교수 382 · 공공기관 529 · 기타 1,047) */
const RE_PROF_TITLE = /(교수|총장|학장|명예교수|초빙|겸임|석좌)/;
const RE_PROF_ORG   = /(대학교|대학원|\b대학\b|University|Univ)/i;
const RE_GOV        = new RegExp(
  "(광역시|특별시|특별자치|[가-힣]{1,4}(시청|도청|군청|구청)|시\\s*청|도\\s*청|의회|" +
  "행정안전부|국토교통부|기획재정부|[가-힣]{2,4}부$|청$|처$|위원회|" +
  "[가-힣]{1,4}시$|[가-힣]{1,4}군$|[가-힣]{1,4}구$|[가-힣]{1,4}도$)");
const RE_PUBLIC     = new RegExp(
  "(연구원|연구소|공사|공단|진흥원|재단|공제회|협회|개발원|정보원|평가원|" +
  "관리원|사업단|본부|출연|LH|SH|GH|코레일|철도공사)");

/** 대학 소속이면 직함이 무엇이든 「교수」 갈래로 봅니다 —
 *  찾을 때 학교 사람은 한자리에 모여 있는 편이 편하기 때문입니다. */
export function kindOf(company, title) {
  const c = String(company || ""), t = String(title || "");
  if (RE_PROF_TITLE.test(t) || RE_PROF_ORG.test(c)) return "prof";
  if (RE_GOV.test(c))    return "gov";
  if (RE_PUBLIC.test(c)) return "public";
  return "etc";
}

/** 화면 위쪽 갈래 단추 */
export const GROUPS = [
  ["all",    "전체",         "#4f9d92"],
  ["gov",    "명함_공무원",   "#2a5fa8"],
  ["prof",   "명함_교수",     "#8a6bb0"],
  ["public", "명함_공공기관", "#b3543b"],
  ["etc",    "명함_기타",     "#7d7768"],
  ["alum",   "동문",         "#c98a3f"],
];
export const GROUP_NAME  = Object.fromEntries(GROUPS.map(([k, v]) => [k, v]));
export const GROUP_COLOR = Object.fromEntries(GROUPS.map(([k, , c]) => [k, c]));


/* ── 값 다듬기 ─────────────────────────────────────────────── */
const txt   = (v) => (v == null ? "" : String(v).trim());
/** 전화번호에서 숫자만 남기고, 국제표기 82 를 0 으로 되돌립니다 */
export function tel(v) {
  let d = txt(v).replace(/[^0-9]/g, "");
  if (d.startsWith("82")) d = "0" + d.slice(2);
  if (d.length < 8) return "";                    // 4~5자리 쓰레기값을 버립니다
  if (d.startsWith("02")) {                       // 서울은 지역번호가 두 자리입니다
    if (d.length === 9)  return "02-" + d.slice(2, 5) + "-" + d.slice(5);
    if (d.length === 10) return "02-" + d.slice(2, 6) + "-" + d.slice(6);
  }
  if (d.length === 11) return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
  return d;
}
/** 동문 명부는 동명이인을 이름 끝 숫자로 갈라 두었습니다 — 보여줄 땐 뗍니다 */
const cleanName = (v) => txt(v).replace(/\s*\d+$/, "");


/* ── 엑셀 한 장을 우리 꼴로 ───────────────────────────────── */
export function fromRemember(rows) {
  return rows.map((r) => {
    const company = txt(r["회사"]);
    const title   = txt(r["직함"]);
    return {
      src: "card",
      kind: kindOf(company, title),
      name: txt(r["이름"]),
      company, title,
      orgDept: txt(r["부서"]),               // 회사의 팀 — 학부가 아닙니다
      email: txt(r["전자 메일 주소"]).toLowerCase(),
      mobile: tel(r["휴대폰"]),
      phone: tel(r["근무처 전화"]),
      addr: txt(r["근무지 주소 번지"]),
      major: "", majorName: "", univDept: "", degree: "", degreeYear: "",
      city: "", tag: txt(r["그룹"]),
      at: txt(r["명함 등록일"]),
    };
  }).filter((x) => x.name || x.company);
}

export function fromUtokyo(rows, headers) {
  // 4번째 칸은 머리글이 비어 있습니다 — 자리로 집어냅니다
  const codeKey = headers[3];
  return rows.map((r) => {
    const code = txt(r[codeKey]).toUpperCase();
    const company = txt(r["Company"]);
    return {
      src: "alum",
      kind: "alum",
      name: cleanName(r["Name_Korean"]),
      nameKanji: txt(r["Name_Kanji"]),
      company,
      title: txt(r["Job.Title"]),
      orgDept: "",
      email: (txt(r["E.mail.Address_1"]) || txt(r["E.mail.Address_2"])).toLowerCase(),
      mobile: tel(r["F"]),
      phone: tel(r["Business.Phone"]),
      addr: "",
      major: code,
      majorName: MAJORS[code] || code,
      univDept: txt(r["Department"]),          // 동경대 학부 — 회사 부서가 아닙니다
      degree: txt(r["Degree"]),
      degreeYear: (txt(r["Degree_year"]).match(/(19|20)\d{2}/) || [""])[0],
      lab: txt(r["LAB"]),
      city: txt(r["Home.City"]),
      tag: "",
      at: "",
    };
  }).filter((x) => x.name);
}


/* ── 내 컴퓨터 파일 기억해 두기 (IndexedDB) ──
   고른 폴더를 다음에 와도 기억합니다. 자료가 아니라 「어느 폴더였는지」만 담습니다. */
const DB = "skyish-addr", STORE = "handle", KEY = "folder";
const openDb = () => new Promise((ok, no) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
async function putHandle(h) {
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(h, KEY);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
  } catch (e) { /* 기억 못 해도 쓰는 데 지장 없습니다 */ }
}
async function getHandle() {
  try {
    const db = await openDb();
    const v = await new Promise((ok, no) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    db.close();
    return v || null;
  } catch (e) { return null; }
}


/* ── 폴더에서 엑셀 두 개 찾아 읽기 ───────────────────────── */
async function readWorkbook(file, XLSX) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb;
}

function sheetRows(XLSX, wb, wanted) {
  const name = wb.SheetNames.find((n) => wanted.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
  return { rows, headers: headers.map((h) => txt(h)) };
}

export async function loadFromFiles(files, say) {
  const XLSX = await import(/* @vite-ignore */ XLSX_LIB);
  let out = [];
  for (const f of files) {
    const n = f.name;
    if (!/\.xlsx?$/i.test(n) || /^~\$/.test(n)) continue;
    if (say) say(n + " 읽는 중…");
    const wb = await readWorkbook(f, XLSX);

    if (/명함/.test(n)) {
      const { rows } = sheetRows(XLSX, wb, /remember/i);
      out = out.concat(fromRemember(rows));
    } else if (/주소록|동문|동경대/.test(n)) {
      // 「의 사본」 시트는 옛 스냅샷이라 건너뜁니다
      const pick = wb.SheetNames.find((s) => /전체주소록/.test(s) && !/사본/.test(s));
      if (pick) {
        const ws = wb.Sheets[pick];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []).map(txt);
        out = out.concat(fromUtokyo(rows, headers));
      }
    }
  }
  return out;
}


/* ══════════════════════════════════════════════════════════ */
export async function initAddr(mountId = "addrapp", sectionId = "addrsec") {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const section = document.getElementById(sectionId);

  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;

  // 관리자가 아니면 이 자리는 아예 없는 것처럼 둡니다
  if (!isAdmin) { if (section) section.remove(); else mount.remove(); return false; }

  const FSA = typeof window.showDirectoryPicker === "function";

  mount.innerHTML =
    '<div class="abar">' +
      '<button type="button" class="nbtn nbtn--go" id="abOpen">📁 주소록 폴더 열기</button>' +
      '<button type="button" class="nbtn" id="abAgain" hidden></button>' +
      (FSA ? "" :
        '<label class="nbtn afiles">📄 엑셀 고르기' +
          '<input type="file" id="abFiles" accept=".xlsx,.xls" multiple hidden></label>') +
      '<span class="ahint" id="abHint">' +
        "고른 자료는 이 화면에만 그려집니다. 어디로도 올라가지 않습니다." +
      "</span>" +
      /* 자료가 아직 없을 때 「사라진 게 아니라 아직 안 읽은 것」 임을 알려 줍니다 */
      '<p class="anot" id="abNot">명함첩과 동문 명부는 <b>내 컴퓨터에만</b> 있습니다.<br>' +
        "브라우저는 페이지를 열 때마다 폴더를 새로 읽어야 해서, " +
        "위 단추를 한 번 누르시면 <b>명함_공무원 · 교수 · 공공기관 · 기타</b> 갈래와 " +
        "찾는 칸이 그대로 돌아옵니다.</p>" +
    "</div>" +
    '<div id="abBody"></div>';

  const hint = document.getElementById("abHint");
  const body = document.getElementById("abBody");
  const say  = (t) => { hint.textContent = t; };

  let rows = [], cur = "all", major = "", shownCount = PAGE;

  /* ── 화면 그리기 ── */
  function ui() {
    const not = document.getElementById("abNot");
    if (not) not.remove();          // 자료가 들어왔으니 안내는 치웁니다

    // 찾는 칸을 갈래 단추보다 위에 둡니다 — 먼저 찾고, 그다음 좁히는 차례라서.
    body.innerHTML =
      '<div class="nbar abbar">' +
        '<label class="nsearch nsearch--big"><span class="sr-only">찾기</span>' +
          '<input type="search" id="abQ" ' +
            'placeholder="이름 · 소속 · 직함 · 전공 · 전화 · 이메일로 찾기" autocomplete="off"></label>' +
        '<button type="button" class="nbtn nbtn--go" id="abGo">🔍 검색</button>' +
        '<select id="abMajor" class="nbtn asel"></select>' +
        '<button type="button" class="nbtn" id="abXls">⤓ 보이는 것만 엑셀로</button>' +
      "</div>" +
      '<nav class="ntabs" id="abTabs"></nav>' +
      '<p class="ncount" id="abCount"></p>' +
      '<div class="nimp__scroll"><table class="nimp__tbl" id="abTbl">' +
        "<thead><tr><th>이름</th><th>소속</th><th>직함</th>" +
        "<th>전공 · 학부</th><th>연락처</th><th>출처</th></tr></thead>" +
        "<tbody></tbody></table></div>" +
      '<p class="nempty" id="abEmpty" hidden></p>' +
      '<div class="amore" id="abMore" hidden></div>' +
      '<div class="ndet" id="abDet"></div>';

    const q = document.getElementById("abQ");
    const sel = document.getElementById("abMajor");
    const tabs = document.getElementById("abTabs");
    const tbody = document.querySelector("#abTbl tbody");
    const countEl = document.getElementById("abCount");
    const emptyEl = document.getElementById("abEmpty");
    const moreEl = document.getElementById("abMore");

    // 전공 고르개 — 동문 자료에 실제로 있는 코드만 넣습니다
    const have = {};
    rows.forEach((r) => { if (r.major) have[r.major] = (have[r.major] || 0) + 1; });
    sel.innerHTML = '<option value="">전공 전체</option>' +
      Object.keys(have).sort((a, b) => have[b] - have[a]).map((k) =>
        `<option value="${esc(k)}">${esc(MAJORS[k] || k)} (${have[k]})</option>`).join("");

    const match = (r) => {
      const s = q.value.trim().toLowerCase();
      if (major && r.major !== major) return false;
      if (!s) return true;
      return [r.name, r.company, r.title, r.orgDept, r.univDept,
              r.majorName, r.major, r.email, r.mobile, r.phone, r.city, r.tag]
        .join(" ").toLowerCase().includes(s);
    };
    const inGroup = (r) => cur === "all" || (cur === "alum" ? r.src === "alum" : r.kind === cur);
    const shown = () => rows.filter(inGroup).filter(match);

    function paint() {
      const l = shown();
      // 갈래 단추 — 지금 찾기말이 걸린 상태의 개수를 함께 셉니다
      tabs.innerHTML = GROUPS.map(([k, label]) => {
        const n = rows.filter((r) => k === "all" || (k === "alum" ? r.src === "alum" : r.kind === k))
                      .filter(match).length;
        return `<button type="button" data-k="${k}"${k === cur ? ' class="on"' : ""}>` +
               `${esc(label)}<span class="n">${n}</span></button>`;
      }).join("");
      tabs.querySelectorAll("button").forEach((b) =>
        b.addEventListener("click", () => { cur = b.dataset.k; shownCount = PAGE; paint(); }));

      countEl.textContent = `${GROUP_NAME[cur]} ${l.length}명` +
        (rows.length !== l.length ? ` · 모두 ${rows.length}명` : "");

      emptyEl.hidden = !!l.length;
      if (!l.length) { emptyEl.textContent = "찾으시는 분이 없습니다."; tbody.innerHTML = ""; }

      const part = l.slice(0, shownCount);
      tbody.innerHTML = part.map((r, i) =>
        `<tr data-i="${rows.indexOf(r)}">` +
          `<td><b>${esc(r.name)}</b>${r.nameKanji ? `<div class="asub">${esc(r.nameKanji)}</div>` : ""}</td>` +
          `<td>${esc(r.company)}${r.orgDept ? `<div class="asub">${esc(r.orgDept)}</div>` : ""}</td>` +
          `<td>${esc(r.title)}</td>` +
          `<td>${r.majorName ? `<b>${esc(r.majorName)}</b>` : ""}` +
            `${r.univDept ? `<div class="asub">${esc(r.univDept)}</div>` : ""}</td>` +
          `<td>${esc(r.mobile || r.phone)}` +
            `${r.email ? `<div class="asub">${esc(r.email)}</div>` : ""}</td>` +
          `<td><span class="ncat" style="--c:${GROUP_COLOR[r.src === "alum" ? "alum" : r.kind]}">` +
            `${esc(r.src === "alum" ? "동문" : GROUP_NAME[r.kind].replace("명함_", ""))}</span></td>` +
        "</tr>").join("");

      moreEl.hidden = l.length <= shownCount;
      moreEl.innerHTML = moreEl.hidden ? "" :
        `<button type="button" class="nbtn" id="abMoreBtn">더 보기 · ${l.length - shownCount}명 남음</button>`;
      const mb = document.getElementById("abMoreBtn");
      if (mb) mb.addEventListener("click", () => { shownCount += PAGE; paint(); });
    }

    // 줄 하나하나에 듣는 이를 붙이면 무겁습니다 — 표 하나에만 걸고 되짚습니다
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (tr) detail(rows[+tr.dataset.i]);
    });

    const run = () => { shownCount = PAGE; paint(); };
    q.addEventListener("input", run);
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
    document.getElementById("abGo").addEventListener("click", () => { run(); q.focus(); });
    sel.addEventListener("change", () => { major = sel.value; shownCount = PAGE; paint(); });
    document.getElementById("abXls").addEventListener("click", () => download(shown()));
    paint();
  }

  /* ── 한 사람 자세히 ── */
  function detail(r) {
    if (!r) return;
    const box = document.getElementById("abDet");
    const line = (k, v) => (v ? `<div class="arow"><b>${esc(k)}</b><span>${esc(v)}</span></div>` : "");
    box.innerHTML =
      '<div class="ndet__box">' +
        '<button type="button" class="ndet__x" id="abX">✕</button>' +
        `<span class="ncat" style="--c:${GROUP_COLOR[r.src === "alum" ? "alum" : r.kind]}">` +
          `${esc(r.src === "alum" ? "동문" : GROUP_NAME[r.kind])}</span>` +
        `<h3>${esc(r.name)}${r.nameKanji ? ` <small>${esc(r.nameKanji)}</small>` : ""}</h3>` +
        '<div class="alist">' +
          line("소속", r.company) + line("부서", r.orgDept) + line("직함", r.title) +
          line("전공", r.majorName) + line("학부", r.univDept) +
          line("학위", [r.degree, r.degreeYear].filter(Boolean).join(" ")) +
          line("연구실", r.lab) +
          line("휴대폰", r.mobile) + line("회사 전화", r.phone) +
          line("이메일", r.email) + line("주소", r.addr) +
          line("지역", r.city) + line("꼬리표", r.tag) + line("명함 등록", r.at) +
        "</div>" +
        '<div class="ndet__foot">' +
          '<button type="button" class="nbtn" id="abClose">닫기</button>' +
        "</div>" +
      "</div>";
    box.classList.add("on");
    const shut = () => box.classList.remove("on");
    document.getElementById("abX").addEventListener("click", shut);
    document.getElementById("abClose").addEventListener("click", shut);
    box.onclick = (e) => { if (e.target === box) shut(); };
  }

  /* ── 보이는 것만 엑셀로 ── */
  function download(list) {
    const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const head = ["이름", "소속", "부서", "직함", "전공", "학부", "학위", "학위연도",
                  "휴대폰", "회사 전화", "이메일", "주소", "지역", "출처"];
    const lines = [head.map(q).join(",")].concat(list.map((r) => [
      r.name, r.company, r.orgDept, r.title, r.majorName, r.univDept, r.degree, r.degreeYear,
      r.mobile, r.phone, r.email, r.addr, r.city, r.src === "alum" ? "동문" : "명함첩",
    ].map(q).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")],
      { type: "text/csv;charset=utf-8" }));
    a.download = "주소록_" + list.length + "명.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ── 파일 읽어 들이기 ── */
  async function useFiles(files) {
    try {
      rows = await loadFromFiles(files, say);
    } catch (e) {
      say("읽지 못했습니다 — " + e.message);
      return;
    }
    if (!rows.length) {
      say("엑셀을 찾지 못했습니다. 「개인명함첩…」 「…주소록…」 이름의 파일이 든 폴더를 골라 주세요.");
      return;
    }
    const nCard = rows.filter((r) => r.src === "card").length;
    const nAlum = rows.length - nCard;
    say(`명함첩 ${nCard}명 · 동문 ${nAlum}명을 읽었습니다. 이 화면에만 있습니다.`);
    ui();
  }

  async function fromDir(dir) {
    const files = [];
    for await (const [, h] of dir.entries()) {
      if (h.kind !== "file") continue;
      if (!/\.xlsx?$/i.test(h.name) || /^~\$/.test(h.name)) continue;
      files.push(await h.getFile());
    }
    await useFiles(files);
  }

  document.getElementById("abOpen").addEventListener("click", async () => {
    if (!FSA) { document.getElementById("abFiles").click(); return; }
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: "skyish-addr", mode: "read" });
    } catch (e) {
      if (e.name !== "AbortError") say("폴더를 열지 못했습니다 — " + e.message);
      return;
    }
    await putHandle(dir);
    await fromDir(dir);
  });

  const filesEl = document.getElementById("abFiles");
  if (filesEl) filesEl.addEventListener("change", (e) => {
    const f = [...e.target.files]; e.target.value = "";
    if (f.length) useFiles(f);
  });

  /* 지난번에 고른 폴더를 되살립니다.
       권한이 이미 있으면(granted)  → 누르지 않아도 바로 읽어 그립니다
       권한을 다시 물어야 하면(prompt) → 창은 사람이 누른 순간에만 뜰 수 있어
                                       「이어서 열기」 단추를 내놓습니다 */
  if (FSA) {
    const h = await getHandle();
    if (h) {
      const btn = document.getElementById("abAgain");
      const st = await h.queryPermission({ mode: "read" }).catch(() => "prompt");
      if (st === "granted") {
        btn.hidden = false;
        btn.textContent = "🔄 " + h.name + " 다시 읽기";
        btn.addEventListener("click", () => fromDir(h));
        say("「" + h.name + "」 을 여는 중…");
        // 권한이 이미 있으니 곧바로 폅니다 — 새로고침할 때마다 안 누르셔도 됩니다
        try { await fromDir(h); }
        catch (e) { say("폴더를 읽지 못했습니다 — 「" + btn.textContent + "」 을 눌러 주세요."); }
      } else if (st === "prompt") {
        btn.hidden = false;
        btn.textContent = "📂 " + h.name + " 이어서 열기";
        btn.addEventListener("click", async () => {
          const g = await h.requestPermission({ mode: "read" });
          if (g === "granted") await fromDir(h);
          else say("권한을 받지 못했습니다. 폴더를 다시 골라 주세요.");
        });
      }
    }
  }

  return true;
}
