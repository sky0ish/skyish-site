/* =============================================================
   [경기도 방위산업 기업체와 연구장비] — defense-cluster.html

   자료: assets/data/defense/points.json
     companies  경기도 소재 방산기업(본사 지오코딩)
     equip      연구장비 보유기관(주소 단위 집계)
     defense    그중 방산 관련 장비만 추린 것
         assets/data/defense/complexes.json  (tools/defense/build_defense_complexes.py)
     items      경기도 산업단지 157곳 — ① 에 별로 얹습니다 (기본은 꺼 둠)
   ============================================================= */
(function () {
  "use strict";

  var DATA_URL = "assets/data/defense/points.json";
  var EQ_COLOR = "#f59e0b", EQ_EDGE = "#92400e";
  var DEF_COLOR = "#dc2626";        // 방산 관련 장비 — ③ 막대에 씁니다
  var GG_CENTER = [37.42, 127.1], GG_ZOOM = 9;

  var doc = null;
  var map0 = null;
  var bothEq = null;                  // 지도① 연구장비 겹
  var bothIc = null;                  // 지도① 산업단지 겹 (별)
  var icDoc = null;                   // complexes.json
  var bothCat = {};                   // 지도① 기업 분야별 겹
  var bothOn = {};                    // 그 가운데 지금 켜 둔 분야
  var sggKey = "co", sggDir = -1;     // 시군별 표 — 기본은 기업 많은 곳부터
  var 방 = null;                      // auth 모듈 (⑤ 가 자료를 더 받습니다)

  /* ---------- 유틸 ---------- */
  function num(n) { return Number(n).toLocaleString("ko-KR"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function busy(id, msg) {
    var b = document.getElementById(id);
    if (!b) return;
    if (msg == null) { b.hidden = true; return; }
    b.hidden = false; b.textContent = msg;
  }
  function baseMap(id) {
    var m = L.map(id, { preferCanvas: true, scrollWheelZoom: true }).setView(GG_CENTER, GG_ZOOM);
    /* CARTO 는 열쇠를 요구해 「API KEY REQUIRED」 도장이 찍힙니다 — Esri 로 바꿉니다 */
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Esri · HERE · OpenStreetMap contributors'
    }).addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    return m;
  }
  /* ---------- 사람에게 보여 줄 말 ---------- */
  function coPopup(d) {
    return "<strong>" + esc(d.name) + "</strong><br>" +
           '<span style="color:#6b6360">' + esc(d.cat) + "</span><br>" +
           esc(d.addr || [d.si, d.sgg, d.emd].filter(Boolean).join(" "));
  }

  /* ---------- 원 크기와 알림창 ---------- */
  function rOf(n) { return Math.max(4, Math.min(26, Math.sqrt(n) * 2.4)); }

  function eqPopup(d) {
    return "<strong>" + esc(d.org) + "</strong><br>" +
           "장비 " + num(d.n) + "대" + (d.orgs > 1 ? " · 기관 " + d.orgs + "곳" : "") +
           (d.field ? " · " + esc(d.field) : "") + "<br>" + esc(d.addr);
  }
  function markerGroup(items, color, edge, popup) {
    return L.featureGroup(items.map(function (d) {
      return L.circleMarker([d.lat, d.lon], {
        radius: rOf(d.n), color: edge, weight: 1, opacity: 0.9,
        fillColor: color, fillOpacity: 0.5
      }).bindPopup(popup(d));
    }));
  }

  /* ---------- 산업단지 — 입체 별 표지 ----------
     CircleMarker 를 빌려 다섯 꼭지 별을 그립니다. 반지름·클릭 판정은 원 그대로 쓰고
     그리는 법만 바꿉니다. 캔버스에서는 별을 열 조각으로 나눠 왼쪽 면은 밝게,
     오른쪽 면은 어둡게 칠하고 그림자를 깔아 입체로 보이게 합니다. (SVG 렌더러로
     떨어지면 납작한 별 — 이 지도는 preferCanvas 라 캔버스입니다.) */
  function shade(hex, k) {            // k>0 밝게, k<0 어둡게
    var n = parseInt(String(hex).replace("#", ""), 16);
    if (isNaN(n)) return hex;
    var f = function (c) { return Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)); };
    return "rgb(" + f(n >> 16) + "," + f((n >> 8) & 255) + "," + f(n & 255) + ")";
  }
  function starPts(p, R) {            // 열 꼭지 — 짝수가 바깥, 홀수가 안쪽
    var pts = [], r = R * 0.46;
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R;
      pts.push([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d]);
    }
    return pts;
  }
  function tracePath(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (q, i) { ctx[i ? "lineTo" : "moveTo"](q[0], q[1]); });
    ctx.closePath();
  }
  L.Canvas.include({
    _updateStar: function (layer) {
      if (!this._drawing || layer._empty()) return;
      var p = layer._point, R = Math.max(Math.round(layer._radius), 3), ctx = this._ctx;
      var o = layer.options, pts = starPts(p, R), base = o.fillColor || "#64748b";
      var light = shade(base, 0.5), dark = shade(base, -0.38);
      ctx.save();
      ctx.globalAlpha = o.fillOpacity == null ? 1 : o.fillOpacity;
      /* 바닥 — 그림자는 윤곽 한 번만 */
      ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = R * 0.35; ctx.shadowOffsetY = R * 0.12;
      tracePath(ctx, pts); ctx.fillStyle = base; ctx.fill();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      /* 열 조각 — 꼭지마다 왼쪽 면 밝게, 오른쪽 면 어둡게 (빛이 왼쪽 위에서) */
      for (var i = 0; i < 5; i++) {
        var tip = pts[i * 2], prev = pts[(i * 2 + 9) % 10], next = pts[i * 2 + 1];
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(prev[0], prev[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath();
        ctx.fillStyle = light; ctx.fill();
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(next[0], next[1]); ctx.closePath();
        ctx.fillStyle = dark; ctx.fill();
      }
      /* 테두리 — 조성 중은 점선 */
      if (o.stroke !== false && o.weight) {
        ctx.globalAlpha = o.opacity == null ? 1 : o.opacity;
        tracePath(ctx, pts);
        ctx.lineWidth = o.weight; ctx.strokeStyle = o.color; ctx.lineJoin = "round";
        if (ctx.setLineDash) ctx.setLineDash(o.dashArray ? String(o.dashArray).split(/[ ,]+/).map(Number) : []);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
  L.SVG.include({
    _updateStar: function (layer) {
      var p = layer._point, R = Math.max(Math.round(layer._radius), 3);
      this._setPath(layer, layer._empty() ? "M0 0" :
        starPts(p, R).map(function (q, i) { return (i ? "L" : "M") + q[0] + " " + q[1]; }).join("") + "z");
    }
  });
  var StarMarker = L.CircleMarker.extend({
    _updatePath: function () { this._renderer._updateStar(this); }
  });

  /* 별 크기 — 지정면적(천㎡) 이 30 부터 15만 까지 자릿수가 달라 로그로 눌러 그립니다.
     도 전체 축척에서 기업 점을 다 가리지 않을 만큼만 — 7 ~ 22px */
  function icR(area) {
    return Math.max(7, Math.min(22, 5 + 2.6 * Math.log(Number(area) / 20 + 1) / Math.LN2));
  }
  /** 범례에 쓰는 작은 별 — 지도 위 것과 같은 모양 */
  function starSvg(color, dashed) {
    var pts = starPts({ x: 8, y: 8.5 }, 7.5).map(function (q) {
      return q[0].toFixed(1) + "," + q[1].toFixed(1);
    }).join(" ");
    return '<svg class="star" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' +
      '<polygon points="' + pts + '" fill="' + (dashed ? "none" : color) + '" stroke="' +
      (dashed ? "#64748b" : shade(color, -0.55)) + '" stroke-width="1"' +
      (dashed ? ' stroke-dasharray="2 1.5"' : "") + "/></svg>";
  }
  function icPopup(d) {
    var 면적 = "지정면적 " + num(d.area) + "천㎡";
    if (d.managed && d.managed !== d.area) 면적 += " · 관리면적 " + num(d.managed) + "천㎡";
    return "<strong>" + esc(d.name) + "</strong> " +
           '<span style="color:#6b6360">' + esc(d.type) + "산업단지 · " + esc(d.status) + "</span><br>" +
           면적 + "<br>" + esc(d.addr || d.si) +
           (d.note ? '<br><span style="color:#8b8280;font-size:.85em">' + esc(d.note) + "</span>" : "");
  }

  /** 산업단지 자료를 따로 받아 별로 얹습니다 — 못 받아도 위 지도는 그대로여야 합니다 */
  function buildIc(m) {
    var cb = document.getElementById("dc-both-ic"), n = document.getElementById("dc-both-ic-n");
    if (!cb || !map0) return;
    cb.disabled = true;
    m.loadAnalysisJson("defense/complexes.json")
      .then(function (j) {
        icDoc = j;
        var color = {};
        (j.types || []).forEach(function (t) { color[t.key] = t.color; });
        bothIc = L.featureGroup((j.items || []).map(function (d) {
          var base = color[d.type] || "#64748b", 조성중 = d.status !== "완료";
          return new StarMarker([d.lat, d.lon], {
            radius: icR(d.area), fillColor: base, fillOpacity: 조성중 ? 0.78 : 1,
            color: 조성중 ? "#fff" : shade(base, -0.55), weight: 조성중 ? 1.5 : 1,
            opacity: 1, dashArray: 조성중 ? "3 2" : null
          }).bindPopup(icPopup(d));
        }));
        if (n) n.textContent = "· " + num(j.n) + "곳";
        cb.disabled = false;
        /* 범례 — 별 크기와 유형 색, 점선은 조성 중 */
        var lg = document.getElementById("dc-legend0");
        if (lg && !document.getElementById("dc-legend0-ic")) {
          var div = document.createElement("div");
          div.id = "dc-legend0-ic"; div.hidden = !cb.checked;
          div.innerHTML = "<hr><b>산업단지 · 별 크기가 지정면적</b>" +
            (j.types || []).map(function (t) {
              return "<div>" + starSvg(t.color, false) +
                     esc(t.key) + ' <span style="color:#8b8280">' + num(t.n) + "</span></div>";
            }).join("") +
            "<div>" + starSvg("#64748b", true) + "점선 테두리 — 조성 중</div>";
          lg.appendChild(div);
        }
        toggleIc(cb.checked);
      })
      .catch(function (e) {
        console.error(e);
        if (n) n.textContent = "· 자료 없음 — complexes.json 을 올려 주세요";
        cb.checked = false;
      });
  }

  /** 산업단지 겹을 켜고 끕니다 */
  function toggleIc(on) {
    if (!bothIc || !map0) return;
    if (on) { if (!map0.hasLayer(bothIc)) bothIc.addTo(map0); }
    else if (map0.hasLayer(bothIc)) map0.removeLayer(bothIc);
    var lg = document.getElementById("dc-legend0-ic");
    if (lg) lg.hidden = !on;
    syncCo();          // 별은 장비 원 위, 기업 점은 그 위로
  }

  /* ---------- 지도 ① 기업체 × 연구장비 ----------
     기업 점과 연구장비 원을 한 장에 포갭니다. 기업은 분야마다 따로 담아
     하나씩 끄고 켤 수 있게 하고, 큰 원에 묻히지 않도록 늘 위로 올립니다. */
  function buildBoth() {
    if (!map0) return;
    var c = doc.companies, e = doc.equip;

    /* 기업 — 분야마다 따로 담아 하나씩 끄고 켭니다 */
    c.cats.forEach(function (cat) {
      bothCat[cat.key] = L.featureGroup(
        c.items.filter(function (d) { return d.cat === cat.key; }).map(function (d) {
          return L.circleMarker([d.lat, d.lon], {
            radius: 5, color: "#fff", weight: 1.2, opacity: 1,
            fillColor: cat.color, fillOpacity: 0.95
          }).bindPopup(coPopup(d));
        }));
      bothOn[cat.key] = true;
    });
    /* 연구장비 — 큰 반투명 원, 반지름이 √장비수 */
    bothEq = markerGroup(e.items, EQ_COLOR, EQ_EDGE, eqPopup);
    bothEq.addTo(map0);

    document.getElementById("dc-both-src").textContent =
      "기업 " + num(c.n) + "개사 · 연구장비 " + num(e.n) + "곳 " + num(e.total) + "대";
    document.getElementById("dc-both-co-n").textContent = "· " + num(c.n) + "개사";
    document.getElementById("dc-both-eq-n").textContent =
      "· " + num(e.n) + "곳 " + num(e.total) + "대";

    /* 체크상자 앞 색딱지 — 기업은 분야마다 색이 달라 띠로 보여 줍니다 */
    var sw = document.getElementById("dc-both-co-sw");
    if (sw && c.cats.length) {
      var step = 100 / c.cats.length;
      sw.style.backgroundImage = "linear-gradient(135deg," + c.cats.map(function (x, i) {
        return x.color + " " + (i * step).toFixed(2) + "%," +
               x.color + " " + ((i + 1) * step).toFixed(2) + "%";
      }).join(",") + ")";
    }

    /* 분야별 체크상자 */
    document.getElementById("dc-both-cats").innerHTML =
      '<fieldset><legend>기업 분야</legend>' + c.cats.map(function (cat) {
        return '<label class="fb-check"><input type="checkbox" data-bcat="' + esc(cat.key) + '" checked>' +
               '<span class="sw" style="border-radius:50%;background:' + cat.color + '"></span>' +
               esc(cat.key) + ' <span style="color:#8b8280">' + num(cat.n) + "</span></label>";
      }).join("") + "</fieldset>";

    document.querySelectorAll("[data-bcat]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        bothOn[cb.dataset.bcat] = cb.checked;
        syncCo();
      });
    });

    document.getElementById("dc-legend0").innerHTML =
      "<b>기업 분야</b>" +
      c.cats.map(function (cat) {
        return '<div><i style="background:' + cat.color + '"></i>' + esc(cat.key) + "</div>";
      }).join("") +
      "<hr><b>연구장비 · 원 크기가 장비 수</b>" +
      '<div><span class="sz" style="width:9px;height:9px"></span>5대 안팎</div>' +
      '<div><span class="sz" style="width:17px;height:17px"></span>50대 안팎</div>' +
      '<div><span class="sz" style="width:26px;height:26px"></span>120대 이상</div>';

    syncCo();
    /* 자료에 맞춰 넓히지 않습니다 — 대전·전주·광주에 있는 여섯 곳(대전 기업 4,
       한국전자기술연구원 지역본부 2)까지 담으려다 지도가 남한 전체로 벌어집니다.
       처음에는 경기도가 꽉 차게 두고, 그 여섯 곳은 축소하면 나옵니다. */
    map0.setView(GG_CENTER, GG_ZOOM);
    busy("dc-busy0", null);
  }

  /** 켜 둔 기업 분야만 지도에 올립니다. 기업 점은 늘 장비 원 위로 올립니다. */
  function syncCo() {
    if (!map0) return;
    Object.keys(bothCat).forEach(function (k) {
      var g = bothCat[k];
      if (bothOn[k]) { if (!map0.hasLayer(g)) g.addTo(map0); }
      else if (map0.hasLayer(g)) map0.removeLayer(g);
    });
    /* 겹 차례 — 장비 원 < 산업단지 별 < 기업 점 */
    if (bothIc && map0.hasLayer(bothIc)) bothIc.bringToFront();
    Object.keys(bothCat).forEach(function (k) {
      if (map0.hasLayer(bothCat[k])) bothCat[k].bringToFront();
    });
    /* 위 「방위산업 기업체」 상자는 분야 상자들의 모둠 스위치입니다 —
       다 켜졌으면 켜짐, 다 꺼졌으면 꺼짐, 섞여 있으면 반쯤 켜짐으로 보입니다. */
    var keys = Object.keys(bothCat);
    var on = keys.filter(function (k) { return bothOn[k]; }).length;
    var master = document.getElementById("dc-both-co");
    if (master) {
      master.checked = on > 0;
      master.indeterminate = on > 0 && on < keys.length;
    }
  }

  /** 위 모둠 스위치 — 기업 분야를 한꺼번에 켜고 끕니다 */
  function toggleCoAll(on) {
    Object.keys(bothCat).forEach(function (k) { bothOn[k] = on; });
    document.querySelectorAll("[data-bcat]").forEach(function (cb) { cb.checked = on; });
    syncCo();
  }

  /** 연구장비 겹을 켜고 끕니다 */
  function toggleEq(on) {
    if (!bothEq || !map0) return;
    if (on) { if (!map0.hasLayer(bothEq)) bothEq.addTo(map0); }
    else map0.removeLayer(bothEq);
    syncCo();          // 기업 점을 다시 위로 올립니다
  }

  /* ---------- ③ 통계 ---------- */
  function bars(mountId, rows, color) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; })) || 1;
    document.getElementById(mountId).innerHTML = rows.map(function (r) {
      return '<div class="fb-bar"><span class="fb-bar__name" title="' + esc(r.label || r.key) + '">' +
             esc(r.label || r.key) + '</span>' +
             '<span class="fb-bar__track"><span class="fb-bar__fill" style="width:' +
             (r.n / max * 100).toFixed(1) + "%;background:" + (r.color || color) + '"></span></span>' +
             '<span class="fb-bar__val">' + num(r.n) + "</span></div>";
    }).join("");
  }

  /* ---------- 시군별 표 — 머리글을 눌러 차례 바꾸기 ---------- */
  /** 총점 — 기업 한 곳을 장비 열 대만큼 쳐서 더한 값.
      기업이 없으면 장비만 많아도 「생태계」 라 부르기 어렵기 때문입니다. */
  var CO_W = 10;
  function score(r) { return (Number(r.co) || 0) * CO_W + (Number(r.eq) || 0); }

  /** 같은 값이면 늘 시군 이름으로 갈라 두 번 눌러도 차례가 흔들리지 않게 합니다 */
  function sggRows() {
    var byName = function (a, b) { return String(a.si).localeCompare(String(b.si), "ko"); };
    var val = function (r) { return sggKey === "score" ? score(r) : (Number(r[sggKey]) || 0); };
    return doc.stats.bySi.slice().sort(function (a, b) {
      if (sggKey === "si") return sggDir * byName(a, b);
      /* 값이 없는 시군(–)은 0 으로 봅니다 */
      var x = val(a), y = val(b);
      return (x === y ? 0 : (x < y ? -1 : 1)) * sggDir || byName(a, b);
    });
  }

  function drawSgg() {
    document.getElementById("dc-sgg").innerHTML = sggRows().map(function (r) {
      return "<tr><td>" + esc(r.si) + "</td><td>" + (r.co ? num(r.co) : "–") +
             "</td><td>" + (r.eq ? num(r.eq) : "–") +
             "</td><td><b>" + num(score(r)) + "</b></td></tr>";
    }).join("");

    document.querySelectorAll("[data-sort]").forEach(function (b) {
      var on = b.dataset.sort === sggKey;
      var th = b.closest("th");
      if (th) {
        if (on) th.setAttribute("aria-sort", sggDir < 0 ? "descending" : "ascending");
        else th.removeAttribute("aria-sort");
      }
      var a = b.querySelector(".fb-sort__a");
      if (a) a.textContent = on ? (sggDir < 0 ? "▼" : "▲") : "↕";
    });
  }

  function sortSgg(key) {
    /* 같은 칸을 다시 누르면 뒤집고, 다른 칸이면 그 칸에 어울리는 쪽부터 —
       이름은 가나다순, 숫자는 많은 곳부터 보는 것이 자연스럽습니다. */
    if (key === sggKey) sggDir = -sggDir;
    else { sggKey = key; sggDir = key === "si" ? 1 : -1; }
    drawSgg();
  }

  function buildStats() {
    bars("dc-bar-cat", doc.companies.cats.map(function (c) {
      return { key: c.key, n: c.n, color: c.color };
    }), "#4f9d92");

    bars("dc-bar-dcat", doc.stats.byDefenseCat.map(function (c) {
      return { key: c.key, n: c.n };
    }), DEF_COLOR);

    drawSgg();

    document.getElementById("dc-meta").innerHTML =
      "<dt>기업</dt><dd>" + esc(doc.companies.label) + " · " + num(doc.companies.n) + "개사</dd>" +
      "<dt>연구장비</dt><dd>2025 경기도 연구장비 데이터 · " + num(doc.equip.total) +
        "대 / " + num(doc.equip.n) + "곳<br>이 가운데 방산 관련 " + num(doc.defense.total) +
        "대 / " + num(doc.defense.n) + "곳</dd>" +
      "<dt>지오코딩</dt><dd>카카오·네이버 주소 검색 결과(도로명 우선, 실패 시 지번)</dd>";
  }

  /* ---------- ② 「원본 그림 보기」 고리 ----------
     ② 는 이제 확대되는 파이 지도입니다. 파이썬이 그린 원본 그림(시군구·읍면동
     경계까지 담긴 것)은 그 아래 고리로 엽니다.
     이 그림도 다른 방산 자료와 같이 비공개 보관함(analysis)에 둡니다 —
     assets/img/ 에 두면 주소만 알면 로그인 없이도 열립니다. */
  function 그림(m) {
    var a = document.getElementById("dc-shot-a");
    var cap = document.getElementById("dc-shot-cap");   // 지금은 없습니다
    if (!a && !cap) return;
    var 안됨 = function (why) {
      if (cap) cap.textContent = why;
      else if (a) a.remove();          // 못 여는 고리는 아예 감춥니다
    };
    /* 네 시간짜리 주소 — 로그인한 분에게만 나옵니다 */
    var box = m.sb && m.sb.storage && m.sb.storage.from("analysis");
    if (!box || typeof box.createSignedUrl !== "function") {
      안됨("그림을 불러오지 못했습니다 — 보관함을 열 수 없습니다.");
      return;
    }
    box.createSignedUrl("defense/equip-map.png", 60 * 60 * 4)
      .then(function (r) {
        if (r.error || !r.data) throw (r.error || new Error("주소를 못 받았습니다"));
        if (a) a.href = r.data.signedUrl;
        if (cap) cap.textContent = "2025 경기도 연구장비 중 방위산업 관련 " +
          "(활용분야·제조사 기준 추출) · 시군구 경계 31 · 읍면동 경계 562";
      })
      .catch(function (e) {
        안됨("그림을 불러오지 못했습니다 — analysis 보관함의 defense 폴더에 " +
             "equip-map.png 를 올려 주세요. (" + String((e && e.message) || e) + ")");
      });
  }

  /* ══════════════════════════════════════════════════════════
     ⑤ 시군별 분포와 전국 대비 강점

       왼쪽 : 경기도 31개 시군마다 방산기업 수 · 연구장비 수 (두 줄 막대)
       오른쪽 : 전국 대비 경기도가 어느 분야에 몰려 있는가 (특화도)

     기업 수는 companies.json(전국 명단)에서, 장비 수는 points.json 에서
     가져옵니다. 두 자료를 함께 쓰는 것은 화면에 보이는 숫자가
     ⑥ 기업 리스트와 어긋나면 안 되기 때문입니다.
     ══════════════════════════════════════════════════════════ */

  /* 경기도 31개 시군 — 자료에 한 곳도 없는 시군도 「없음」 으로 보여야
     31개 가운데 어디가 비어 있는지 알 수 있습니다. */
  var GG31 = ["수원시", "성남시", "의정부시", "안양시", "부천시", "광명시", "평택시",
              "동두천시", "안산시", "고양시", "과천시", "구리시", "남양주시", "오산시",
              "시흥시", "군포시", "의왕시", "하남시", "용인시", "파주시", "이천시",
              "안성시", "김포시", "화성시", "광주시", "양주시", "포천시", "여주시",
              "연천군", "가평군", "양평군"];

  /* 원본 대분류가 제각각이라 ① 과 같은 일곱 갈래로 모읍니다
     (build_defense_network.py 의 CAT_MAP 과 같은 규칙) */
  var CAT_MAP = {
    "전자/제어/통신/센서": "전자/제어/통신/센서",
    "하드웨어": "하드웨어/소재", "소재": "하드웨어/소재",
    "우주/항공/드론": "우주/항공/드론", "드론": "우주/항공/드론",
    "우주/항공": "우주/항공/드론", "드론/로봇": "우주/항공/드론",
    "AI": "AI/디지털트윈", "디지털트윈": "AI/디지털트윈",
    "반도체": "반도체", "로봇": "로봇",
  };
  function catOf(v) {
    var k = String(v == null ? "" : v).trim();
    if (CAT_MAP[k]) return CAT_MAP[k];
    /* 「소재(압전소자/진동체), 광학」 처럼 길게 적힌 것은 앞말로 가릅니다 */
    var keys = Object.keys(CAT_MAP);
    for (var i = 0; i < keys.length; i++) {
      if (k.indexOf(keys[i]) === 0) return CAT_MAP[keys[i]];
    }
    return "기타";                       // 시험/인증·에너지·건설·물류 등
  }

  /** 「경기도 성남시 분당구」 → 「성남시」 */
  function siOf(where) {
    var w = String(where == null ? "" : where);
    var i = w.indexOf("(본사)");
    if (i >= 0) w = w.slice(0, i);
    for (var j = 0; j < GG31.length; j++) {
      if (w.indexOf(GG31[j]) >= 0) return GG31[j];
    }
    /* 「안성」 처럼 「시」 가 빠진 표기도 받아 줍니다 */
    for (var k = 0; k < GG31.length; k++) {
      var bare = GG31[k].replace(/[시군]$/, "");
      if (bare.length > 1 && w.indexOf(bare) >= 0) return GG31[k];
    }
    return "";
  }

  var siRows = [], siSort = "co", lqRows = [];
  var siTop = 15;                     // 처음에는 상위 15곳만 (0 이면 모두)

  function buildSi(cos) {
    /* ① 기업 — 전국 명단에서 경기도 줄만 */
    var co = {};
    GG31.forEach(function (n) { co[n] = 0; });
    (cos && cos.rows ? cos.rows : []).forEach(function (r) {
      if (r.region !== "경기") return;
      var si = siOf(r.where);
      if (si) co[si]++;
    });
    /* ② 장비 — points.json 의 시군별 집계 */
    var eq = {};
    GG31.forEach(function (n) { eq[n] = 0; });
    (doc.stats.bySi || []).forEach(function (r) {
      var si = siOf(r.si) || siOf(String(r.si) + "시");
      if (si && r.eq) eq[si] += Number(r.eq) || 0;
    });
    siRows = GG31.map(function (n) { return { si: n, co: co[n], eq: eq[n] }; });

    var nCo = siRows.reduce(function (a, b) { return a + b.co; }, 0);
    var nEq = siRows.reduce(function (a, b) { return a + b.eq; }, 0);
    var 빈곳 = siRows.filter(function (r) { return !r.co && !r.eq; }).length;
    var el = document.getElementById("dc-si-src");
    if (el) {
      el.textContent = "경기 31개 시군 · 기업 " + num(nCo) + "개사 · 연구장비 " +
                       num(nEq) + "대" + (빈곳 ? " (둘 다 없는 곳 " + 빈곳 + ")" : "");
    }
    drawSi();
  }

  function drawSi() {
    var box = document.getElementById("dc-si");
    if (!box) return;
    var L = siRows.slice();
    if (siSort === "name") L.sort(function (a, b) { return a.si.localeCompare(b.si, "ko"); });
    else L.sort(function (a, b) {
      return b[siSort] - a[siSort] || b.co - a.co ||
             a.si.localeCompare(b.si, "ko");
    });
    /* 잣대는 **자른 뒤가 아니라 31곳 전체**를 기준으로 둡니다 —
       상위 15곳만 볼 때와 모두 볼 때 막대 길이가 달라지면 헷갈립니다. */
    var mCo = Math.max.apply(null, siRows.map(function (r) { return r.co; })) || 1;
    var mEq = Math.max.apply(null, siRows.map(function (r) { return r.eq; })) || 1;
    var 잘림 = 0;
    if (siTop && L.length > siTop) { 잘림 = L.length - siTop; L = L.slice(0, siTop); }
    var bar = function (n, max, color) {
      return '<div class="dc-si__b"><span class="dc-si__t">' +
        (n ? '<span class="dc-si__f" style="width:' + (n / max * 100).toFixed(1) +
             "%;background:" + color + '"></span>' : "") +
        '</span><span class="dc-si__v">' + (n ? num(n) : "–") + "</span></div>";
    };
    box.innerHTML = L.map(function (r) {
      return '<div class="dc-si__row' + (!r.co && !r.eq ? " dc-si__z" : "") + '"' +
        ' title="' + esc(r.si) + " — 기업 " + num(r.co) + "개사 · 연구장비 " +
        num(r.eq) + '대">' +
        '<span class="dc-si__nm">' + esc(r.si) + "</span>" +
        '<span class="dc-si__bars">' +
          bar(r.co, mCo, "#4f9d92") + bar(r.eq, mEq, EQ_COLOR) +
        "</span></div>";
    }).join("");
    if (잘림) {
      box.innerHTML += '<p class="fb-sub" style="margin:.6rem 0 0">' +
        "나머지 " + 잘림 + "곳은 「31개 모두」 를 누르시면 나옵니다.</p>";
    }
    document.querySelectorAll("[data-sisort]").forEach(function (b) {
      var on = b.dataset.sisort === siSort;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-sitop]").forEach(function (b) {
      var on = Number(b.dataset.sitop) === siTop;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function buildLq(cos) {
    var rows = (cos && cos.rows ? cos.rows : []);
    if (!rows.length) return;
    var tot = {}, gg = {}, N = 0, G = 0;
    rows.forEach(function (r) {
      var k = catOf(r.cat);
      tot[k] = (tot[k] || 0) + 1; N++;
      if (r.region === "경기") { gg[k] = (gg[k] || 0) + 1; G++; }
    });
    var color = {};
    (doc.companies.cats || []).forEach(function (c) { color[c.key] = c.color; });
    lqRows = Object.keys(tot).map(function (k) {
      var lq = (G && tot[k]) ? (((gg[k] || 0) / G) / (tot[k] / N)) : 0;
      return { key: k, all: tot[k], gg: gg[k] || 0, lq: lq,
               color: color[k] || "#94a3b8" };
    }).sort(function (a, b) { return b.lq - a.lq || b.all - a.all; });

    var sub = document.getElementById("dc-lq-sub");
    if (sub) {
      sub.textContent = "전국 " + num(N) + "개사 가운데 경기도 " + num(G) +
                        "개사 (" + (G / N * 100).toFixed(0) + "%)";
    }
    var box = document.getElementById("dc-lq");
    if (!box) return;
    /* 눈금은 특화도 2.5 까지 — 1.0 자리를 늘 같은 곳에 두어 견주기 쉽게 */
    var TOP = Math.max(2.5, Math.ceil(Math.max.apply(null,
      lqRows.map(function (r) { return r.lq; })) * 10) / 10);
    box.innerHTML = lqRows.map(function (r) {
      var w = Math.min(100, r.lq / TOP * 100);
      var 셈 = "경기 " + num(r.gg) + " / 전국 " + num(r.all) +
               " (" + (r.all ? (r.gg / r.all * 100).toFixed(0) : 0) + "%)";
      return '<div class="dc-lq__row">' +
        '<span class="dc-lq__nm" title="' + esc(r.key) + '">' + esc(r.key) + "</span>" +
        '<span class="dc-lq__t">' +
          '<span class="dc-lq__f" style="width:' + w.toFixed(1) + "%;background:" +
            (r.lq >= 1 ? r.color : "#d6d0ca") + '"></span>' +
          '<i class="dc-lq__one" style="left:' + (1 / TOP * 100).toFixed(1) +
            '%" title="전국 평균"></i>' +
        "</span>" +
        '<span class="dc-lq__v' + (r.lq >= 1 ? " up" : "") + '">' +
          r.lq.toFixed(2) + "</span>" +
        '<span class="dc-lq__sub">' + esc(셈) + "</span>" +
      "</div>";
    }).join("");
  }

  /** ⑤ — 기업 명단을 따로 받아 와 그립니다 (⑥ 리스트와 같은 자료) */
  function buildFive(m) {
    m.loadAnalysisJson("defense/companies.json")
      .then(function (cos) { buildSi(cos); buildLq(cos); })
      .catch(function (e) {
        var el = document.getElementById("dc-si-src");
        if (el) el.textContent = "기업 명단을 불러오지 못했습니다 — " +
          String((e && e.message) || e);
        /* 장비 쪽만이라도 그립니다 */
        buildSi(null);
      });
    document.querySelectorAll("[data-sisort]").forEach(function (b) {
      b.addEventListener("click", function () {
        siSort = b.dataset.sisort;
        drawSi();
      });
    });
    document.querySelectorAll("[data-sitop]").forEach(function (b) {
      b.addEventListener("click", function () {
        siTop = Number(b.dataset.sitop) || 0;
        /* 가나다순으로 「상위 15」 는 뜻이 없으니 기업 많은 곳으로 돌려 둡니다 */
        if (siTop && siSort === "name") siSort = "co";
        drawSi();
      });
    });
  }

  /* ---------- 시작 ---------- */
  function start() {
    if (!document.getElementById("dc-map0")) return;
    map0 = baseMap("dc-map0");
    busy("dc-busy0", "자료를 불러오는 중입니다…");

    // 비공개 보관함(analysis)에서 받습니다 — 승인된 분만 열 수 있습니다
    import("../../auth/auth.js")
      .then(function (m) {
        방 = m;                          // 뒤에서 ⑤ 가 다시 씁니다
        /* ② 그려 둔 그림은 자료와 따로 받아 옵니다.
           여기서 무슨 일이 나도 아래 지도·통계까지 멎으면 안 됩니다. */
        try { 그림(m); } catch (e) { console.error(e); }
        return m.loadAnalysisJson("defense/points.json");
      })
      .then(function (j) {
        doc = j;
        buildBoth();
        buildStats();
        /* 산업단지 별 — 자료를 따로 받습니다. 없어도 지도는 그대로입니다. */
        try { buildIc(방); } catch (e) { console.error(e); }
        /* ⑤ 는 기업 명단을 따로 받습니다 — 여기서 무슨 일이 나도
           위 지도와 ④ 통계는 그대로여야 합니다. */
        try { buildFive(방); } catch (e) { console.error(e); }
      })
      .catch(function (err) {
        console.error(err);
        var msg = "자료를 불러오지 못했습니다: " + err.message +
                  (location.protocol === "file:" ? " — 웹서버(preview.cmd)로 열어 주세요." : "");
        busy("dc-busy0", msg);
      });

    var mCo = document.getElementById("dc-both-co");
    if (mCo) mCo.addEventListener("change", function () { toggleCoAll(mCo.checked); });
    var mEq = document.getElementById("dc-both-eq");
    if (mEq) mEq.addEventListener("change", function () { toggleEq(mEq.checked); });
    var mIc = document.getElementById("dc-both-ic");
    if (mIc) mIc.addEventListener("change", function () { toggleIc(mIc.checked); });

    document.querySelectorAll("[data-sort]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (doc) sortSgg(b.dataset.sort);
      });
    });

  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
