/* =============================================================
   수도권 방산기업 리스트 — defense-companies.html

   자료: analysis 보관함의 defense/companies.json
     cols  화면에 보일 칸의 차례와 이름
     rows  기업 한 곳이 한 줄. _fill 이 있으면 그 칸은 조사로 채운 것.

   · 머리글을 누르면 그 항목으로 정렬합니다 (한 번 더 누르면 뒤집습니다).
   · 글자 칸은 가나다순, 숫자 칸은 큰 것부터가 처음 차례입니다.
   · 빈 칸은 어느 쪽으로 정렬하든 늘 뒤로 보냅니다 — 앞에 몰리면 표가 안 읽힙니다.
   ============================================================= */
(function () {
  "use strict";

  var doc = null;
  var sortKey = "no", sortDir = 1;
  var region = "all";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function num(n) { return Number(n).toLocaleString("ko-KR"); }

  /* 숫자로 견줄 칸 — 나머지는 글자로 견줍니다 */
  var NUMERIC = { no: 1, staff: 1 };
  /* 넓게 풀어 쓸 칸 */
  var LONG = { field: 1, rnd: 1, tech: 1 };
  var MID = { partner: 1, award: 1, where: 1, listed: 1, sub: 1 };

  function val(r, k) {
    var v = r[k];
    return v == null ? "" : String(v);
  }

  function rows() {
    var q = (document.getElementById("dl-q").value || "").trim().toLowerCase();
    var list = doc.rows.filter(function (r) {
      if (region !== "all" && r.region !== region) return false;
      if (!q) return true;
      return doc.cols.some(function (c) {
        return val(r, c.key).toLowerCase().indexOf(q) >= 0;
      });
    });
    var byName = function (a, b) {
      return String(a.name).localeCompare(String(b.name), "ko");
    };
    return list.sort(function (a, b) {
      var x = val(a, sortKey), y = val(b, sortKey);
      /* 빈 칸은 늘 뒤로 — 오름차순이든 내림차순이든 */
      if (!x && !y) return byName(a, b);
      if (!x) return 1;
      if (!y) return -1;
      var d;
      if (NUMERIC[sortKey]) {
        var nx = parseFloat(x.replace(/[^0-9.\-]/g, "")) || 0;
        var ny = parseFloat(y.replace(/[^0-9.\-]/g, "")) || 0;
        d = nx === ny ? 0 : (nx < ny ? -1 : 1);
      } else {
        d = x.localeCompare(y, "ko");
      }
      return d * sortDir || byName(a, b);
    });
  }

  function head() {
    document.getElementById("dl-head").innerHTML = doc.cols.map(function (c) {
      var on = c.key === sortKey;
      return "<th scope=\"col\"" +
        (on ? ' aria-sort="' + (sortDir < 0 ? "descending" : "ascending") + '"' : "") +
        '><button type="button" class="dl-sort" data-k="' + esc(c.key) + '">' +
        esc(c.label) + ' <span class="dl-sort__a">' +
        (on ? (sortDir < 0 ? "▼" : "▲") : "↕") + "</span></button></th>";
    }).join("");
    document.querySelectorAll("[data-k]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.k;
        if (k === sortKey) sortDir = -sortDir;
        /* 이름·글자는 가나다순부터, 숫자는 큰 것부터 보는 것이 자연스럽습니다 */
        else { sortKey = k; sortDir = NUMERIC[k] ? -1 : 1; }
        draw();
      });
    });
  }

  function cell(r, c) {
    var v = val(r, c.key);
    var filled = r._fill && r._fill[c.key];
    var mine = r._mine && r._mine[c.key];
    var cls = LONG[c.key] ? "long" : (MID[c.key] ? "mid" : "");
    var inner;
    if (!v) inner = '<span class="dl-empty">–</span>';
    else if (c.key === "region") inner = '<span class="dl-reg">' + esc(v) + "</span>";
    else if (c.key === "site" && /^https?:\/\//i.test(v))
      inner = '<a href="' + esc(v) + '" target="_blank" rel="noopener">홈페이지 →</a>';
    else if (v === "O") inner = '<span class="dl-yes">O</span>';
    else inner = esc(v);
    if (v && mine) {
      inner = '<span class="dl-mine" title="손으로 고친 칸입니다.">' + inner + "</span>";
    } else if (v && filled) {
      inner = '<span class="dl-fill" title="원본 표에 비어 있던 칸입니다 — ' +
              esc(filled) + '. 확인 뒤 쓰세요.">' + inner + "</span>";
    }
    return '<td class="' + cls + '" data-k="' + esc(c.key) + '">' + inner + "</td>";
  }

  function draw() {
    head();
    grips();
    cols();
    var list = rows();
    document.getElementById("dl-body").innerHTML = list.map(function (r) {
      return '<tr data-i="' + doc.rows.indexOf(r) + '">' +
             doc.cols.map(function (c) { return cell(r, c); }).join("") + "</tr>";
    }).join("") ||
      '<tr><td colspan="' + doc.cols.length + '" style="padding:2rem;text-align:center;color:#8b8280">' +
      "찾으시는 기업이 없습니다.</td></tr>";
    document.getElementById("dl-count").textContent =
      num(list.length) + "개사" + (list.length === doc.rows.length ? "" : " / 전체 " + num(doc.rows.length));
    var sv = document.getElementById("dl-save");
    if (sv) {
      sv.textContent = "⤓ 엑셀로 내려받기 (" + num(list.length) + "개사)";
      sv.disabled = !list.length;
      sv.title = list.length === doc.rows.length
        ? "지금 표에 있는 " + num(list.length) + "개사를 CSV 로 내려받습니다"
        : "지금 걸러 놓으신 " + num(list.length) + "개사만 내려받습니다";
    }
    document.querySelectorAll("[data-reg]").forEach(function (b) {
      var on = b.dataset.reg === region;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    /* 줄이 바뀌면 칸 폭도 바뀝니다 — 바 길이를 다시 맞춥니다 */
    if (xbarSync) xbarSync();
  }

  function tabs() {
    var by = doc.meta.byRegion || {};
    var mk = function (key, label, n) {
      return '<button type="button" class="chip" data-reg="' + esc(key) + '">' +
             esc(label) + ' <span class="n">' + num(n) + "</span></button>";
    };
    document.getElementById("dl-tabs").innerHTML =
      mk("all", "전체", doc.rows.length) +
      Object.keys(by).map(function (k) { return mk(k, k, by[k]); }).join("");
    document.querySelectorAll("[data-reg]").forEach(function (b) {
      b.addEventListener("click", function () { region = b.dataset.reg; draw(); });
    });
  }

  /** 못 읽었을 때 — 보관함 안을 직접 들여다보고 무엇이 있는지 알려 줍니다.
   *  「올렸는데 안 나온다」 는 대개 폴더나 이름이 조금 다른 것이라,
   *  화면이 실제 목록을 보여 주는 편이 훨씬 빠릅니다. */
  function why(m, err) {
    var box = document.getElementById("dl-note");
    var raw = String((err && err.message) || "");
    box.innerHTML = '<b>기업 명단을 불러오지 못했습니다.</b>' +
      (raw ? ' <span class="dl-empty">(' + esc(raw) + ')</span>' : "") +
      '<br><span class="dl-empty">보관함 안을 확인하는 중…</span>';
    /* analysis 보관함의 defense 폴더에 무엇이 들어 있는지 그대로 보여 줍니다 */
    m.sb.storage.from("analysis").list("defense", { limit: 100 })
      .then(function (r) {
        if (r.error) throw r.error;
        var names = (r.data || []).map(function (f) { return f.name; });
        var has = names.indexOf("companies.json") >= 0;
        box.innerHTML = has
          ? '<b>파일은 있는데 읽지 못했습니다.</b> <span class="dl-empty">(' +
            esc(raw) + ')</span><br>' +
            '올리실 때 <b>덮어쓰기</b>가 제대로 되었는지, 파일이 온전한지 봐 주세요.'
          : '<b>analysis / defense 폴더에 <code>companies.json</code> 이 없습니다.</b><br>' +
            '지금 그 폴더에 있는 것: ' +
            (names.length ? '<code>' + names.map(esc).join("</code> · <code>") + '</code>'
                          : '<span class="dl-empty">(비어 있음)</span>') + '<br>' +
            '<span class="dl-empty">이름이 <code>companies.json</code> 인지, ' +
            'analysis 보관함의 <code>defense</code> 폴더 <b>안</b>인지 봐 주세요. ' +
            '만드는 곳: tools/defense/build_defense_companies.py</span>';
      })
      .catch(function (e2) {
        box.innerHTML = '<b>기업 명단을 불러오지 못했습니다.</b><br>' +
          '<span class="dl-empty">보관함도 열어 보지 못했습니다 — ' +
          esc(String((e2 && e2.message) || raw || "까닭 모름")) +
          '. 로그인이 풀렸거나 승인 상태가 아닐 수 있습니다.</span>';
      });
    document.getElementById("dl-body").innerHTML =
      '<tr><td style="padding:2rem;text-align:center;color:#8b8280">' +
      "위 안내를 봐 주세요.</td></tr>";
  }




  /* ══════════════════════════════════════════════════════════
     고치기 · 더하기 — 관리자로 들어오셨을 때만

       「내 아이디로 로그인햇을 때 칸을 추가해서 내용을 수정하거나
         더 넣을수도 있게해줘」

     원본 엑셀은 건드리지 않습니다. 고치신 것은 같은 보관함의
     defense/companies-edits.json 에 **따로** 담고, 볼 때마다 원본 위에 얹습니다.
     그래서 엑셀로 companies.json 을 새로 만들어 올려도 고치신 것은 그대로 남습니다.
     원본과 고친 것이 다르면 **고치신 쪽이 이깁니다.**
     ══════════════════════════════════════════════════════════ */
  var EDIT_PATH = "defense/companies-edits.json";
  var sb = null, canEdit = false, editing = false;
  var over = { edits: {}, added: [] };      // 원본 위에 얹는 것
  var dirty = false;

  /** 이름을 맞대 볼 열쇠 — 파이썬 쪽 samename() 과 같은 규칙입니다 */
  function keyOf(name) {
    var t2 = String(name == null ? "" : name).trim()
      .replace(/㈜/g, "").replace(/\(주\)/g, "").replace(/주식회사/g, "");
    while (/\)$/.test(t2) && t2.indexOf("(") >= 0) {
      t2 = t2.slice(0, t2.lastIndexOf("(")).trim();
    }
    return t2.replace(/\s+/g, "").toLowerCase();
  }

  function emsg(text, kind) {
    var el = document.getElementById("dl-editmsg");
    if (!el) return;
    el.hidden = !text;
    el.className = "dl-editmsg" + (kind ? " " + kind : "");
    el.textContent = text || "";
  }

  /** 원본 줄 위에 고치신 것을 얹습니다 */
  function applyOver() {
    var add = (over.added || []).map(function (r) {
      var row = { _new: true };
      doc.cols.forEach(function (c) { row[c.key] = r[c.key] || ""; });
      return row;
    });
    doc.rows = doc.rows.filter(function (r) { return !r._new; }).concat(add);
    doc.rows.forEach(function (r) {
      var e = (over.edits || {})[keyOf(r.name)];
      if (!e) { delete r._mine; return; }
      var mine = {};
      Object.keys(e).forEach(function (f) {
        if (f === "_at") return;
        r[f] = e[f];
        mine[f] = 1;
      });
      r._mine = mine;
    });
    /* 지역은 본사 소재지를 따릅니다 — 주소를 고치시면 탭도 따라 움직입니다 */
    doc.rows.forEach(function (r) {
      var w = String(r.where || "").trim();
      if (!w) return;
      var i = w.indexOf("(본사)");
      var head = (i >= 0 ? w.slice(0, i + 4) : w).split(/\s+/)[0].split("(")[0];
      var got = ["경기", "서울", "인천"].filter(function (k) {
        return head.indexOf(k) === 0;
      })[0];
      r.region = got || "기타";
    });
    doc.meta.byRegion = {};
    doc.rows.forEach(function (r) {
      doc.meta.byRegion[r.region] = (doc.meta.byRegion[r.region] || 0) + 1;
    });
  }

  async function loadOver(m) {
    try {
      var got = await m.loadAnalysisJson(EDIT_PATH);
      if (got && typeof got === "object") {
        over.edits = got.edits || {};
        over.added = got.added || [];
      }
    } catch (e) { /* 아직 고친 것이 없으면 없는 것이 맞습니다 */ }
  }

  /** 담기 — 읽어서 합친 뒤 올립니다. 남이 고친 것을 덮지 않으려는 것입니다. */
  async function saveOver() {
    if (!sb) { emsg("보관함을 열 수 없습니다.", "err"); return false; }
    emsg("담는 중…");
    try {
      /* 올리기 직전에 다시 읽어 남의 손질과 합칩니다 */
      var cur = { edits: {}, added: [] };
      try {
        var r0 = await sb.storage.from("analysis").download(EDIT_PATH);
        if (r0.data) {
          var j = JSON.parse(await r0.data.text());
          cur.edits = j.edits || {};
          cur.added = j.added || [];
        }
      } catch (e) {}
      Object.keys(over.edits).forEach(function (k) { cur.edits[k] = over.edits[k]; });
      var 있는이름 = {};
      cur.added.forEach(function (a) { 있는이름[keyOf(a.name)] = a; });
      over.added.forEach(function (a) { 있는이름[keyOf(a.name)] = a; });
      cur.added = Object.keys(있는이름).map(function (k) { return 있는이름[k]; });
      cur.at = new Date().toISOString();

      var body = new Blob([JSON.stringify(cur, null, 1)], { type: "application/json" });
      var up = await sb.storage.from("analysis").upload(EDIT_PATH, body, {
        upsert: true, cacheControl: "0", contentType: "application/json",
      });
      if (up.error) throw up.error;
      over.edits = cur.edits; over.added = cur.added;
      dirty = false;
      emsg("담았습니다 — 고친 칸 " + Object.keys(cur.edits).length +
           "개사, 더한 기업 " + cur.added.length + "개사.", "ok");
      return true;
    } catch (e) {
      emsg("담지 못했습니다 — " + String((e && e.message) || e), "err");
      return false;
    }
  }

  /** 칸 하나를 고칠 수 있게 엽니다 */
  function openCell(td) {
    if (!editing || td.dataset.k === "no" || td.dataset.k === "region") return;
    if (td.getAttribute("contenteditable") === "true") return;
    var tr = td.closest("tr");
    var row = doc.rows[+tr.dataset.i];
    if (!row) return;
    var was = String(row[td.dataset.k] || "");
    td.textContent = was;
    td.setAttribute("contenteditable", "true");
    td.focus();
    /* 커서를 글 끝에 둡니다 */
    var sel = window.getSelection(), rg = document.createRange();
    rg.selectNodeContents(td); rg.collapse(false);
    sel.removeAllRanges(); sel.addRange(rg);

    var done = function (keep) {
      td.removeAttribute("contenteditable");
      td.removeEventListener("blur", onBlur);
      td.removeEventListener("keydown", onKey);
      var now = td.textContent.trim();
      if (!keep || now === was) { draw(); return; }
      var k = keyOf(row.name);
      if (row._new) {
        var a = (over.added || []).filter(function (x) {
          return keyOf(x.name) === k;
        })[0];
        if (a) a[td.dataset.k] = now;
      } else {
        over.edits[k] = over.edits[k] || {};
        over.edits[k][td.dataset.k] = now;
      }
      row[td.dataset.k] = now;
      dirty = true;
      applyOver();
      tabs();
      draw();
      emsg("고쳤습니다 — 「담기」 를 눌러야 남습니다.", "");
    };
    var onBlur = function () { done(true); };
    var onKey = function (e) {
      if (e.key === "Escape") { e.preventDefault(); done(false); }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); td.blur(); }
    };
    td.addEventListener("blur", onBlur);
    td.addEventListener("keydown", onKey);
  }

  function setEditing(on) {
    editing = !!on;
    document.body.classList.toggle("dl-editing", editing);
    var b = document.getElementById("dl-editmode");
    var a = document.getElementById("dl-add");
    if (b) {
      b.classList.toggle("on", editing);
      b.textContent = editing ? "✓ 담기" : "✎ 고치기";
      b.title = editing ? "고친 것을 보관함에 담습니다" : "칸을 눌러 고칠 수 있게 합니다";
    }
    if (a) a.hidden = !editing;
    emsg(editing
      ? "칸을 눌러 고치세요. Enter 로 마치고 Esc 로 되돌립니다. " +
        "다 하시면 「담기」 를 눌러 주세요 — 그래야 남습니다."
      : "", "");
  }

  function addRow() {
    var name = prompt("더할 기업 이름을 적어 주세요.");
    if (!name || !name.trim()) return;
    name = name.trim();
    if (doc.rows.some(function (r) { return keyOf(r.name) === keyOf(name); })) {
      emsg("이미 있는 기업입니다: " + name, "err");
      return;
    }
    var row = { name: name };
    doc.cols.forEach(function (c) { row[c.key] = row[c.key] || ""; });
    row.where = (prompt("본사 소재지 (예: 경기도 성남시)", "") || "").trim();
    over.added = (over.added || []).concat([row]);
    dirty = true;
    applyOver();
    tabs();
    /* 새로 더한 기업이 바로 보이게 이름으로 찾아 둡니다 */
    var q2 = document.getElementById("dl-q");
    if (q2) q2.value = name;
    region = "all";
    draw();
    emsg("더했습니다 — 칸을 눌러 내용을 채우신 뒤 「담기」 를 눌러 주세요.", "ok");
  }

  function wireEdit() {
    var b = document.getElementById("dl-editmode");
    var a = document.getElementById("dl-add");
    if (!b) return;
    b.hidden = false;
    b.addEventListener("click", async function () {
      if (!editing) { setEditing(true); return; }
      if (dirty) {
        b.disabled = true;
        var ok = await saveOver();
        b.disabled = false;
        /* 못 담았으면 고치기를 끄지 않습니다 — 끄면 고치신 것이 조용히 사라집니다 */
        if (!ok) return;
      }
      var was = document.getElementById("dl-editmsg");
      var keep = was ? was.textContent : "";
      setEditing(false);
      if (keep) emsg(keep, "ok");
    });
    if (a) a.addEventListener("click", addRow);
    var body = document.getElementById("dl-body");
    if (body) body.addEventListener("click", function (e) {
      var td = e.target.closest ? e.target.closest("td") : null;
      if (td) openCell(td);
    });
    /* 담지 않고 나가시려 하면 붙잡습니다 */
    window.addEventListener("beforeunload", function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  /* ── 내려받기 ──────────────────────────────────────────────
     지금 화면에 보이는 그대로(지역 탭·찾기말·줄 세운 차례) 내보냅니다.
     엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM 을 붙입니다. */
  function save() {
    var list = rows();
    var q = function (v) {
      return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    };
    var head = doc.cols.map(function (c) { return c.label; });
    /* 조사로 채운 칸은 눈으로 가릴 수 있게 표시를 남깁니다 */
    var line = function (r) {
      return doc.cols.map(function (c) {
        var v = val(r, c.key);
        if (v && r._fill && r._fill[c.key]) v += "  [확인필요]";
        return q(v);
      }).join(",");
    };
    var body = [head.map(q).join(",")].concat(list.map(line)).join("\r\n");

    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var day = String(d.getFullYear()) + pad(d.getMonth() + 1) + pad(d.getDate());
    var 어디 = region === "all" ? "전체" : region;
    var name = "방산기업_" + 어디 + "_" + list.length + "개사_" + day + ".csv";

    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + body],
      { type: "text/csv;charset=utf-8" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ── 칸 너비 조절 ──────────────────────────────────────────
     머리글 사이를 끌어 너비를 바꿉니다. 정한 너비는 이 브라우저에 담아 두어
     다시 오셔도 그대로입니다.

     표를 table-layout:fixed 로 두어야 끄는 대로 정확히 따라옵니다.
     그래서 칸마다 너비가 있어야 하고, 처음 값은 아래 표에서 가져옵니다. */
  var WKEY = "skyish-dl-w";
  var W0 = {                       // 처음 너비 (px)
    no: 52, region: 54, name: 170, cat: 132, sub: 128, field: 300,
    rnd: 260, tech: 300, isDef: 74, where: 168, motie: 90, innov: 132,
    assoc: 122, skku: 88, listed: 150, partner: 170, award: 150,
    staff: 76, founded: 96, site: 96,
  };
  var wid = {};

  function loadW() {
    wid = {};
    try {
      var got = JSON.parse(localStorage.getItem(WKEY) || "{}");
      Object.keys(got).forEach(function (k) {
        var n = parseInt(got[k], 10);
        if (n > 30 && n < 1400) wid[k] = n;
      });
    } catch (e) { /* 못 읽어도 처음 너비로 갑니다 */ }
  }
  function saveW() {
    try { localStorage.setItem(WKEY, JSON.stringify(wid)); } catch (e) {}
  }
  function wOf(k) { return wid[k] || W0[k] || 120; }

  /** <colgroup> 을 다시 그리고, 붙어 있는 첫 세 칸의 자리를 맞춥니다 */
  function cols() {
    var cg = document.getElementById("dl-cols");
    var tbl = document.getElementById("dl-table");
    if (!cg || !tbl || !doc) return;
    cg.innerHTML = doc.cols.map(function (c) {
      return '<col style="width:' + wOf(c.key) + 'px">';
    }).join("");
    var total = doc.cols.reduce(function (n, c) { return n + wOf(c.key); }, 0);
    tbl.style.width = total + "px";
    /* 왼쪽에 붙여 둔 칸(번호·지역·기업명)의 자리는 앞 칸 너비의 합입니다 */
    var w1 = wOf(doc.cols[0].key), w2 = wOf(doc.cols[1].key);
    tbl.style.setProperty("--l2", w1 + "px");
    tbl.style.setProperty("--l3", (w1 + w2) + "px");
  }

  /** 머리글마다 오른쪽 끝에 끌 손잡이를 답니다 */
  function grips() {
    var head = document.getElementById("dl-head");
    if (!head) return;
    [].forEach.call(head.children, function (th, i) {
      if (i >= doc.cols.length - 1) return;      // 마지막 칸은 끌 것이 없습니다
      var g = document.createElement("span");
      g.className = "dl-grip";
      g.title = "끌어서 칸 너비 조절";
      g.dataset.gk = doc.cols[i].key;
      th.appendChild(g);
    });
  }

  function wireGrip() {
    var head = document.getElementById("dl-head");
    if (!head) return;
    head.addEventListener("mousedown", function (e) {
      var g = e.target.closest ? e.target.closest(".dl-grip") : null;
      if (!g) return;
      e.preventDefault();
      var key = g.dataset.gk;
      var x0 = e.clientX, w0 = wOf(key);
      g.classList.add("on");
      document.body.classList.add("dl-sizing");
      var move = function (ev) {
        var w = Math.max(44, Math.min(900, w0 + (ev.clientX - x0)));
        wid[key] = Math.round(w);
        cols();
      };
      var up = function () {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        g.classList.remove("on");
        document.body.classList.remove("dl-sizing");
        saveW();
        if (xbarSync) xbarSync();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    /* 손잡이를 두 번 누르면 그 칸만 처음 너비로 */
    head.addEventListener("dblclick", function (e) {
      var g = e.target.closest ? e.target.closest(".dl-grip") : null;
      if (!g) return;
      delete wid[g.dataset.gk];
      cols(); saveW();
      if (xbarSync) xbarSync();
    });
    var rs = document.getElementById("dl-wreset");
    if (rs) rs.addEventListener("click", function () {
      wid = {}; saveW(); cols();
      if (xbarSync) xbarSync();
    });
  }

  /* ── 가로 이동 바 ──────────────────────────────────────────
     표가 스무 칸이 넘어 오른쪽이 화면 밖으로 나갑니다. 표 안쪽 스크롤바는
     표 맨 아래에 있어서, 긴 표에서는 끝까지 내려가야 손이 닿습니다.
     그래서 화면에 붙어 다니는 바를 따로 두고 양쪽을 맞춰 줍니다. */
  var xbarSync = null;

  function xbar() {
    var wrap = document.querySelector(".dl-scroll");
    var bar = document.getElementById("dl-xbar");
    var track = document.getElementById("dl-xtrack");
    var inner = document.getElementById("dl-xin");
    if (!wrap || !bar || !track || !inner) return;
    var tbl = wrap.querySelector("table");

    var maxX = function () {
      return tbl ? Math.max(0, tbl.scrollWidth - wrap.clientWidth) : 0;
    };
    var ends = function () {
      var l = document.getElementById("dl-xl");
      var r = document.getElementById("dl-xr");
      var max = maxX();
      if (l) l.disabled = wrap.scrollLeft <= 1;
      if (r) r.disabled = wrap.scrollLeft >= max - 1;
    };
    var sync = function () {
      var over = maxX();
      bar.hidden = over <= 4;                    // 넘치지 않으면 바를 감춥니다
      if (bar.hidden) return;
      inner.style.width = tbl.scrollWidth + "px";
      if (Math.abs(track.scrollLeft - wrap.scrollLeft) > 1) track.scrollLeft = wrap.scrollLeft;
      ends();
    };

    /* 둘 중 어느 쪽을 움직여도 다른 쪽이 따라옵니다.
       서로 밀어대며 떨지 않도록 「지금 누가 움직이는 중인가」 를 표시해 둡니다. */
    var busy = false;
    track.addEventListener("scroll", function () {
      if (busy) return;
      busy = true; wrap.scrollLeft = track.scrollLeft; ends(); busy = false;
    });
    wrap.addEventListener("scroll", function () {
      if (busy) return;
      busy = true; track.scrollLeft = wrap.scrollLeft; ends(); busy = false;
    });

    /* 단추는 바 전체에 한 번만 걸어 둡니다 — 표를 다시 그려도 살아 있습니다.
       scrollTo({behavior:"smooth"}) 는 이 자리에서 듣지 않는 일이 있어
       값을 바로 넣습니다. 확실히 도는 쪽을 씁니다. */
    bar.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-x]") : null;
      if (!b) return;
      var x = b.dataset.x === "r" ? maxX() : 0;
      busy = true;
      wrap.scrollLeft = x;
      track.scrollLeft = x;
      busy = false;
      ends();
    });

    /* Shift+휠로도 가로로 갑니다 — 손이 편합니다 */
    wrap.addEventListener("wheel", function (e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      wrap.scrollLeft += e.deltaY;
    }, { passive: false });

    window.addEventListener("resize", sync);
    xbarSync = sync;
    sync();
  }

  function start() {
    if (!document.getElementById("dl-body")) return;
    import("../../auth/auth.js").then(function (m) {
      sb = m.sb;
      return m.loadAnalysisJson("defense/companies.json")
        .then(async function (j) {
          doc = j;
          document.getElementById("dl-note").textContent = j.meta.note;
          /* 고치신 것을 원본 위에 얹습니다 */
          await loadOver(m);
          applyOver();
          loadW();
          tabs();
          draw();
          wireGrip();
          xbar();
          var sv = document.getElementById("dl-save");
          if (sv) sv.addEventListener("click", save);
          document.getElementById("dl-q").addEventListener("input", draw);
          /* 관리자면 고치기·더하기를 켭니다 */
          try {
            var me = await m.myProfile();
            var u = await m.currentUser();
            var OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
            canEdit = !!(me && me.is_admin) ||
              OWNERS.indexOf((((u || {}).email) || "").toLowerCase()) >= 0;
            if (canEdit) wireEdit();
          } catch (e) { /* 못 알아보면 그냥 보기만 합니다 */ }
        })
        .catch(function (err) { console.error(err); why(m, err); });
    }).catch(function (err) {
      console.error(err);
      document.getElementById("dl-note").textContent =
        "자료를 불러오지 못했습니다: " + String((err && err.message) || err);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
