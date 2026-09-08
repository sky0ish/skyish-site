/* =============================================================
   장비 × 기업 관계망 — defense-cluster.html 의 텍스트마이닝 칸

     회색 점 = 장비 이름 (264개)
     색 점   = 기업 이름 (136개) — 색은 다른 그림과 같은 분야 색
     선     = 그 기업이 그 장비를 쓸 만한 사이 (기업↔기관 연결을 타고)

   위 칩에서 장비 기능을 고르면 그 기능에 걸린 장비와, 그것을 쓸 만한
   기업만 남깁니다. 전체는 이음이 2,967개라 실뭉치가 되어서, 기능 하나를
   고르고 보시는 편이 훨씬 잘 읽힙니다.

   자리는 힘 시늉(force layout)으로 한 번만 잡고 멈춥니다 — 계속 움직이면
   눈이 피로하고, 무엇을 보고 있었는지 놓칩니다.
   ============================================================= */
(function () {
  "use strict";

  var EQ_COLOR = "#8b8280";          // 장비 — 회색
  var TICKS = 320;                   // 자리를 잡는 데 쓰는 걸음 수
  var W = 0, H = 0;                  // 그림판 크기 (CSS 픽셀)

  var doc = null, colorOf = {}, canvas = null, ctx = null, dpr = 1;
  var nodes = [], links = [], byId = {};
  var view = { x: 0, y: 0, k: 1 };   // 밀고 당김
  var hover = null, picked = null, onlyKw = null;
  var found = null;                  // 찾기에 걸린 점들 {id:1}
  var near = null;                   // 고른 점에 붙은 것들

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  var num = function (n) { return Number(n).toLocaleString("ko-KR"); };

  /* ── 그래프 만들기 ──────────────────────────────────────── */

  /** 장비 노드의 열쇠 — 같은 이름이 여러 기관에 있어 기관까지 넣습니다 */
  function eqId(sid, name) { return sid + "|" + name; }

  function build(kwKey) {
    var kw = doc.kw;
    var sites = {}, cos = {};
    doc.sites.forEach(function (s) { sites[s.id] = s; });
    doc.companies.forEach(function (c) { cos[c.id] = c; });

    /* ① 장비 노드 — kw.eg 는 기관 → 기능 → [장비 이름] */
    var eq = {};
    Object.keys(kw.eg || {}).forEach(function (sid) {
      Object.keys(kw.eg[sid]).forEach(function (k) {
        if (kwKey && k !== kwKey) return;
        (kw.eg[sid][k] || []).forEach(function (nm) {
          var id = eqId(sid, nm);
          if (!eq[id]) {
            eq[id] = { id: id, kind: "eq", name: nm, sid: sid,
                       site: (sites[sid] || {}).name || "", kws: [] };
          }
          if (eq[id].kws.indexOf(k) < 0) eq[id].kws.push(k);
        });
      });
    });

    /* ② 기관마다 이어진 기업 */
    var bySite = {};
    doc.edges.forEach(function (e) {
      (bySite[e.s] = bySite[e.s] || []).push(e.c);
    });

    /* ③ 기업—장비 이음. 장비가 있는 기관에 이어진 기업만 담습니다. */
    var L = [], useCo = {};
    Object.keys(eq).forEach(function (id) {
      var sid = eq[id].sid;
      (bySite[sid] || []).forEach(function (cid) {
        if (!cos[cid]) return;
        useCo[cid] = true;
        L.push({ a: cid, b: id });
      });
    });

    var N = [];
    Object.keys(useCo).forEach(function (cid) {
      var c = cos[cid];
      N.push({ id: cid, kind: "co", name: c.name, cat: c.cat, rawCat: c.rawCat,
               si: c.si, deg: 0 });
    });
    Object.keys(eq).forEach(function (id) { eq[id].deg = 0; N.push(eq[id]); });

    var map = {};
    N.forEach(function (n) { map[n.id] = n; });
    L.forEach(function (l) {
      if (map[l.a]) map[l.a].deg++;
      if (map[l.b]) map[l.b].deg++;
    });

    nodes = N; links = L; byId = map;
    layout();
  }

  /** 점의 반지름 — 이어진 수가 많을수록 큽니다 */
  function rOf(n) {
    return n.kind === "co" ? Math.max(3.5, Math.min(13, 2.6 + Math.sqrt(n.deg) * 1.5))
                           : Math.max(2.6, Math.min(9, 2.2 + Math.sqrt(n.deg) * 0.9));
  }

  /* ── 자리 잡기 (힘 시늉) ────────────────────────────────
     · 모든 점끼리 밀어냅니다 (400점이면 한 걸음에 8만 번 — 견딜 만합니다)
     · 이어진 점끼리 당깁니다
     · 가운데로 살짝 모읍니다
     한 번 잡고 멈춥니다. 계속 흔들리면 읽기가 어렵습니다. */
  function layout() {
    var n = nodes.length;
    if (!n) return;
    /* 씨앗을 고정합니다 — 새로 그릴 때마다 자리가 달라지면 어지럽습니다 */
    var seed = 20260909;
    var rnd = function () {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    var R = Math.min(W, H) * 0.42 || 300;
    nodes.forEach(function (d, i) {
      var a = (i / n) * Math.PI * 2, rr = R * (0.35 + rnd() * 0.65);
      d.x = Math.cos(a) * rr; d.y = Math.sin(a) * rr;
      d.vx = 0; d.vy = 0;
    });

    var k = Math.sqrt((R * R * 3) / n);       // 알맞은 사이 거리
    for (var t = 0; t < TICKS; t++) {
      var cool = 1 - t / TICKS;
      for (var i = 0; i < n; i++) {
        var a2 = nodes[i];
        for (var j = i + 1; j < n; j++) {
          var b2 = nodes[j];
          var dx = a2.x - b2.x, dy = a2.y - b2.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 1e-6) { dx = (i - j) * 0.01 + 0.01; dy = 0.01; d2 = dx * dx + dy * dy; }
          if (d2 > k * k * 36) continue;       // 멀면 무시 — 이것만으로 크게 빨라집니다
          var f = (k * k) / d2;
          a2.vx += dx * f; a2.vy += dy * f;
          b2.vx -= dx * f; b2.vy -= dy * f;
        }
      }
      links.forEach(function (l) {
        var a3 = byId[l.a], b3 = byId[l.b];
        if (!a3 || !b3) return;
        var dx = b3.x - a3.x, dy = b3.y - a3.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        var f = (d - k) * 0.06;
        var ux = (dx / d) * f, uy = (dy / d) * f;
        a3.vx += ux; a3.vy += uy;
        b3.vx -= ux; b3.vy -= uy;
      });
      nodes.forEach(function (d) {
        d.vx -= d.x * 0.0012; d.vy -= d.y * 0.0012;      // 가운데로
        var sp = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
        var cap = 14 * cool + 0.4;
        if (sp > cap) { d.vx = d.vx / sp * cap; d.vy = d.vy / sp * cap; }
        d.x += d.vx; d.y += d.vy;
        d.vx *= 0.55; d.vy *= 0.55;
      });
    }
    fit();
  }

  /** 그림판에 꽉 차게 맞춥니다 */
  function fit() {
    if (!nodes.length) return;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    nodes.forEach(function (d) {
      if (d.x < x0) x0 = d.x; if (d.x > x1) x1 = d.x;
      if (d.y < y0) y0 = d.y; if (d.y > y1) y1 = d.y;
    });
    var pad = 34;
    var k = Math.min((W - pad * 2) / Math.max(1, x1 - x0),
                     (H - pad * 2) / Math.max(1, y1 - y0));
    view.k = Math.max(0.15, Math.min(4, k));
    view.x = W / 2 - ((x0 + x1) / 2) * view.k;
    view.y = H / 2 - ((y0 + y1) / 2) * view.k;
  }

  var sx = function (d) { return d.x * view.k + view.x; };
  var sy = function (d) { return d.y * view.k + view.y; };

  /* ── 그리기 ─────────────────────────────────────────────── */
  function paint() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var focus = picked || hover;
    /* 선 — 평소에는 아주 흐리게. 하나를 고르면 그것만 또렷하게. */
    links.forEach(function (l) {
      var a = byId[l.a], b = byId[l.b];
      if (!a || !b) return;
      var on = focus && (l.a === focus.id || l.b === focus.id);
      ctx.globalAlpha = focus ? (on ? 0.75 : 0.03) : 0.075;
      ctx.strokeStyle = colorOf[a.cat] || "#94a3b8";
      ctx.lineWidth = on ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(sx(a), sy(a));
      ctx.lineTo(sx(b), sy(b));
      ctx.stroke();
    });

    /* 점 — 장비를 먼저, 기업을 그 위에 */
    ctx.globalAlpha = 1;
    var order = nodes.slice().sort(function (a, b) {
      return (a.kind === "co" ? 1 : 0) - (b.kind === "co" ? 1 : 0) || a.deg - b.deg;
    });
    order.forEach(function (d) {
      var hitFind = found && found[d.id];
      var dim = (focus && !(near && near[d.id]) && d.id !== focus.id) ||
                (found && !hitFind);
      var r = rOf(d) * Math.max(0.75, Math.min(1.6, view.k));
      ctx.globalAlpha = dim ? 0.12 : 1;
      ctx.beginPath();
      ctx.arc(sx(d), sy(d), r, 0, Math.PI * 2);
      ctx.fillStyle = d.kind === "co" ? (colorOf[d.cat] || "#94a3b8") : EQ_COLOR;
      ctx.fill();
      if (d.kind === "co") {
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.stroke();
      }
      /* 찾은 점에는 테를 둘러 눈에 띄게 합니다 */
      if (hitFind) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(sx(d), sy(d), r + 4, 0, Math.PI * 2);
        ctx.lineWidth = 2; ctx.strokeStyle = "#1c1a19"; ctx.stroke();
      }
    });

    /* 이름 — 이어진 수가 많은 것과, 지금 보고 있는 것 */
    ctx.globalAlpha = 1;
    ctx.font = '11px "Noto Sans KR", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    var big = nodes.slice().sort(function (a, b) { return b.deg - a.deg; })
                   .slice(0, view.k > 1.4 ? 40 : 16);
    var show = big.slice();
    if (found) {
      show = nodes.filter(function (d) { return found[d.id]; })
                  .sort(function (a, b) { return b.deg - a.deg; }).slice(0, 30);
    }
    if (focus) {
      show = nodes.filter(function (d) { return d.id === focus.id || (near && near[d.id]); })
                  .sort(function (a, b) { return b.deg - a.deg; }).slice(0, 26);
    }
    show.forEach(function (d) {
      var x = sx(d), y = sy(d) - rOf(d) - 3;
      if (x < -60 || x > W + 60 || y < 0 || y > H + 20) return;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(250,248,246,.92)";
      ctx.strokeText(d.name, x, y);
      ctx.fillStyle = d.kind === "co" ? "#1c1a19" : "#6b6360";
      ctx.fillText(d.name, x, y);
    });
  }

  /** 고른 점에 붙은 이웃을 미리 셈해 둡니다 */
  function setFocus(d) {
    if (!d) { near = null; return; }
    near = {};
    links.forEach(function (l) {
      if (l.a === d.id) near[l.b] = 1;
      else if (l.b === d.id) near[l.a] = 1;
    });
  }

  function hit(mx, my) {
    var best = null, bd = 15 * 15;
    nodes.forEach(function (d) {
      var dx = sx(d) - mx, dy = sy(d) - my;
      var dd = dx * dx + dy * dy;
      var r = Math.max(7, rOf(d) + 4);
      if (dd < Math.max(bd, r * r) && dd < bd) { bd = dd; best = d; }
    });
    return best;
  }

  function info(d) {
    var box = document.getElementById("dc-g-info");
    if (!box) return;
    if (!d) {
      box.innerHTML = '<p class="fb-sub">점 위에 마우스를 올리거나 눌러 보세요. ' +
        "고른 점에 이어진 것만 또렷해집니다.</p>";
      return;
    }
    var lab = {};
    (doc.kw.groups || []).forEach(function (g) { lab[g.key] = g.label; });
    var 이웃 = nodes.filter(function (x) { return near && near[x.id]; })
                    .sort(function (a, b) { return b.deg - a.deg; });
    if (d.kind === "eq") {
      box.innerHTML =
        '<h4><span class="dot" style="background:' + EQ_COLOR + '"></span>' + esc(d.name) + "</h4>" +
        '<p class="fb-sub">' + esc(d.site) + "</p>" +
        '<p class="fb-sub">기능: ' + d.kws.map(function (k) {
          return esc(lab[k] || k);
        }).join(" · ") + "</p>" +
        "<ul class='dc-net-list'><li class='hd'>이 장비를 쓸 만한 기업 " + 이웃.length + "개사</li>" +
        이웃.slice(0, 40).map(function (x) {
          return "<li><b>" + esc(x.name) + "</b><br><span class=\"fb-sub\">" +
                 '<span class="dot" style="display:inline-block;background:' +
                 (colorOf[x.cat] || "#94a3b8") + '"></span> ' + esc(x.rawCat || x.cat) +
                 "</span></li>";
        }).join("") + "</ul>";
      return;
    }
    box.innerHTML =
      '<h4><span class="dot" style="background:' + (colorOf[d.cat] || "#94a3b8") + '"></span>' +
      esc(d.name) + "</h4>" +
      '<p class="fb-sub">' + esc(d.rawCat || d.cat) + (d.si ? " · " + esc(d.si) : "") + "</p>" +
      "<ul class='dc-net-list'><li class='hd'>쓸 만한 장비 " + 이웃.length + "대</li>" +
      이웃.slice(0, 40).map(function (x) {
        return "<li><b>" + esc(x.name) + "</b><br>" +
               '<span class="fb-sub">' + esc(x.site) + "</span></li>";
      }).join("") + "</ul>";
  }

  function count() {
    var el = document.getElementById("dc-g-src");
    if (!el) return;
    var nEq = nodes.filter(function (d) { return d.kind === "eq"; }).length;
    var nCo = nodes.length - nEq;
    el.textContent = "장비 " + num(nEq) + "개 · 기업 " + num(nCo) +
                     "개사 · 이음 " + num(links.length) + "개";
  }

  /* ── 크기·조작 ──────────────────────────────────────────── */
  function resize() {
    var box = canvas.parentNode;
    W = box.clientWidth; H = box.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }

  function wire() {
    var drag = null;
    canvas.addEventListener("mousemove", function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) {
        view.x += mx - drag.x; view.y += my - drag.y;
        drag.x = mx; drag.y = my; drag.moved = true;
        paint();
        return;
      }
      var h = hit(mx, my);
      canvas.style.cursor = h ? "pointer" : "grab";
      if (h === hover) return;
      hover = h;
      if (!picked) { setFocus(hover); info(hover); }
      paint();
    });
    canvas.addEventListener("mouseleave", function () {
      hover = null;
      if (!picked) { setFocus(null); info(null); }
      paint();
    });
    canvas.addEventListener("mousedown", function (e) {
      var r = canvas.getBoundingClientRect();
      drag = { x: e.clientX - r.left, y: e.clientY - r.top, moved: false };
      canvas.style.cursor = "grabbing";
    });
    window.addEventListener("mouseup", function (e) {
      if (!drag) return;
      if (!drag.moved) {
        var r = canvas.getBoundingClientRect();
        var h = hit(e.clientX - r.left, e.clientY - r.top);
        picked = (picked && h && picked.id === h.id) ? null : h;
        setFocus(picked || hover);
        info(picked || hover);
        paint();
      }
      drag = null;
      canvas.style.cursor = "grab";
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var f = Math.exp(-e.deltaY * 0.0015);
      var k2 = Math.max(0.2, Math.min(8, view.k * f));
      view.x = mx - (mx - view.x) * (k2 / view.k);
      view.y = my - (my - view.y) * (k2 / view.k);
      view.k = k2;
      paint();
    }, { passive: false });

    var res = document.getElementById("dc-g-reset");
    if (res) res.addEventListener("click", function () {
      picked = null; hover = null; setFocus(null); info(null);
      clearFind(); fit(); paint();
    });
    window.addEventListener("resize", function () {
      resize(); fit(); paint();
    });
  }


  /* ── 찾기 ────────────────────────────────────────────────
     기업명·장비명으로 찾습니다. 띄어쓰기와 대소문자는 가리지 않습니다.
     고르면 그 점으로 지도를 옮기고 이어진 것을 펴 보여 줍니다. */
  function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, "").toLowerCase(); }

  function search(q) {
    var k = norm(q);
    if (k.length < 1) return [];
    return nodes.filter(function (d) {
      return norm(d.name).indexOf(k) >= 0 ||
             (d.kind === "eq" && norm(d.site).indexOf(k) >= 0) ||
             (d.kind === "co" && norm(d.rawCat || d.cat).indexOf(k) >= 0);
    }).sort(function (a, b) {
      /* 이름이 그 말로 시작하는 것을 먼저, 그다음 이어진 수가 많은 것 */
      var sa = norm(a.name).indexOf(k) === 0 ? 0 : 1;
      var sb = norm(b.name).indexOf(k) === 0 ? 0 : 1;
      return sa - sb || b.deg - a.deg;
    });
  }

  /** 그 점으로 옮겨 가 고릅니다 */
  function goTo(d) {
    if (!d) return;
    view.k = Math.max(view.k, 1.8);
    view.x = W / 2 - d.x * view.k;
    view.y = H / 2 - d.y * view.k;
    picked = d;
    setFocus(d);
    info(d);
    paint();
  }

  function drawSug(list, q) {
    var box = document.getElementById("dc-g-sug");
    if (!box) return;
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    if (!list.length) {
      box.innerHTML = '<p class="none">찾으시는 기업·장비가 없습니다.</p>';
      return;
    }
    box.innerHTML = list.slice(0, 30).map(function (d, i) {
      var col = d.kind === "co" ? (colorOf[d.cat] || "#94a3b8") : EQ_COLOR;
      return '<button type="button" data-gi="' + i + '">' +
        '<span class="dot" style="background:' + col + '"></span>' +
        '<b>' + esc(d.name) + "</b>" +
        "<small>" + (d.kind === "co"
          ? esc(d.rawCat || d.cat) + (d.si ? " · " + esc(d.si) : "") +
            " · 쓸 만한 장비 " + num(d.deg) + "대"
          : esc(d.site) + " · 이 장비를 쓸 만한 기업 " + num(d.deg) + "개사") +
        "</small></button>";
    }).join("");
    box.querySelectorAll("[data-gi]").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = list[+b.dataset.gi];
        box.hidden = true;
        var inp = document.getElementById("dc-g-q");
        if (inp) inp.value = d.name;
        found = {}; found[d.id] = 1;
        goTo(d);
        markFind(1);
      });
    });
  }

  function markFind(n) {
    var el = document.getElementById("dc-g-qn");
    var x = document.getElementById("dc-g-qx");
    if (el) el.textContent = found ? n + "개 찾음" : "";
    if (x) x.hidden = !found;
  }

  function clearFind() {
    found = null;
    var inp = document.getElementById("dc-g-q");
    if (inp) inp.value = "";
    var box = document.getElementById("dc-g-sug");
    if (box) { box.hidden = true; box.innerHTML = ""; }
    markFind(0);
    paint();
  }

  function wireFind() {
    var inp = document.getElementById("dc-g-q");
    if (!inp) return;
    var last = [];
    var run = function () {
      var q = inp.value.trim();
      if (!q) { clearFind(); return; }
      last = search(q);
      found = {};
      last.forEach(function (d) { found[d.id] = 1; });
      if (!last.length) found = null;
      picked = null; setFocus(null); info(null);
      drawSug(last, q);
      markFind(last.length);
      paint();
    };
    inp.addEventListener("input", run);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { clearFind(); inp.blur(); }
      if (e.key === "Enter") {
        e.preventDefault();
        if (last.length) {
          var box = document.getElementById("dc-g-sug");
          if (box) box.hidden = true;
          found = {}; found[last[0].id] = 1;
          inp.value = last[0].name;
          goTo(last[0]);
          markFind(1);
        }
      }
    });
    inp.addEventListener("focus", function () {
      if (inp.value.trim() && last.length) drawSug(last, inp.value.trim());
    });
    document.addEventListener("click", function (e) {
      var box = document.getElementById("dc-g-sug");
      if (!box || box.hidden) return;
      if (!e.target.closest || !e.target.closest(".dc-g__find")) box.hidden = true;
    });
    var x = document.getElementById("dc-g-qx");
    if (x) x.addEventListener("click", clearFind);
  }

  /* ── 밖에서 부르는 문 ───────────────────────────────────── */
  window.DC_GRAPH = {
    /** @param d network.json · @param colors 분야 → 색 */
    init: function (d, colors) {
      doc = d; colorOf = colors || {};
      canvas = document.getElementById("dc-g-canvas");
      if (!canvas || !doc || !doc.kw) return false;
      ctx = canvas.getContext("2d");
      resize();
      build(null);
      count(); info(null); paint(); wire(); wireFind();
      var b = document.getElementById("dc-busy6");
      if (b) b.hidden = true;
      return true;
    },
    /** 위 칩에서 기능을 고르면 그 기능만 남깁니다 (null 이면 전부) */
    filter: function (kwKey) {
      if (!ctx) return;
      onlyKw = kwKey || null;
      picked = null; hover = null; near = null;
      build(onlyKw);
      /* 찾아 둔 것이 이 기능에는 없을 수 있어 비웁니다 */
      clearFind();
      count(); info(null); paint();
    },
  };
})();
