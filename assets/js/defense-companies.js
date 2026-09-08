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
    var cls = LONG[c.key] ? "long" : (MID[c.key] ? "mid" : "");
    var inner;
    if (!v) inner = '<span class="dl-empty">–</span>';
    else if (c.key === "region") inner = '<span class="dl-reg">' + esc(v) + "</span>";
    else if (c.key === "site" && /^https?:\/\//i.test(v))
      inner = '<a href="' + esc(v) + '" target="_blank" rel="noopener">홈페이지 →</a>';
    else if (v === "O") inner = '<span class="dl-yes">O</span>';
    else inner = esc(v);
    if (v && filled) {
      inner = '<span class="dl-fill" title="원본 표에 비어 있던 칸입니다 — ' +
              esc(filled) + '. 확인 뒤 쓰세요.">' + inner + "</span>";
    }
    return '<td class="' + cls + '">' + inner + "</td>";
  }

  function draw() {
    head();
    var list = rows();
    document.getElementById("dl-body").innerHTML = list.map(function (r) {
      return "<tr>" + doc.cols.map(function (c) { return cell(r, c); }).join("") + "</tr>";
    }).join("") ||
      '<tr><td colspan="' + doc.cols.length + '" style="padding:2rem;text-align:center;color:#8b8280">' +
      "찾으시는 기업이 없습니다.</td></tr>";
    document.getElementById("dl-count").textContent =
      num(list.length) + "개사" + (list.length === doc.rows.length ? "" : " / 전체 " + num(doc.rows.length));
    document.querySelectorAll("[data-reg]").forEach(function (b) {
      var on = b.dataset.reg === region;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
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

  function start() {
    if (!document.getElementById("dl-body")) return;
    import("../../auth/auth.js")
      .then(function (m) { return m.loadAnalysisJson("defense/companies.json"); })
      .then(function (j) {
        doc = j;
        document.getElementById("dl-note").textContent = j.meta.note;
        tabs();
        draw();
        document.getElementById("dl-q").addEventListener("input", draw);
      })
      .catch(function (err) {
        console.error(err);
        var m = String((err && err.message) || "");
        /* 가장 흔한 까닭은 「아직 안 올림」 입니다 — 무엇을 어디에 올려야 하는지
           화면에서 바로 알 수 있게 적어 둡니다. */
        var missing = /not found|없습니다|404|Object not found|Bucket/i.test(m);
        document.getElementById("dl-note").innerHTML = missing
          ? '<b>기업 명단 자료가 아직 올라가 있지 않습니다.</b><br>' +
            'Supabase → Storage → <b>analysis</b> 보관함에 ' +
            '<code>defense/companies.json</code> 으로 올려 주세요.<br>' +
            '<span class="dl-empty">만드는 곳: tools/defense/build_defense_companies.py ' +
            '→ assets/data/defense/companies.json</span>'
          : "자료를 불러오지 못했습니다: " + esc(m);
        document.getElementById("dl-body").innerHTML =
          '<tr><td style="padding:2rem;text-align:center;color:#8b8280">' +
          (missing ? "자료를 올리시면 여기에 명단이 나옵니다." : esc(m)) + "</td></tr>";
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
