/* =============================================================
   [경기도 방위산업 기업체와 연구장비] — defense-cluster.html

   자료: assets/data/defense/points.json
     companies  경기도 소재 방산기업(본사 지오코딩)
     equip      연구장비 보유기관(주소 단위 집계)
     defense    그중 방산 관련 장비만 추린 것
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
  var bothCat = {};                   // 지도① 기업 분야별 겹
  var bothOn = {};                    // 그 가운데 지금 켜 둔 분야
  var sggKey = "co", sggDir = -1;     // 시군별 표 — 기본은 기업 많은 곳부터

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

  /* ---------- 시작 ---------- */
  function start() {
    if (!document.getElementById("dc-map0")) return;
    map0 = baseMap("dc-map0");
    busy("dc-busy0", "자료를 불러오는 중입니다…");

    // 비공개 보관함(analysis)에서 받습니다 — 승인된 분만 열 수 있습니다
    import("../../auth/auth.js")
      .then(function (m) {
        /* ② 그려 둔 그림은 자료와 따로 받아 옵니다.
           여기서 무슨 일이 나도 아래 지도·통계까지 멎으면 안 됩니다. */
        try { 그림(m); } catch (e) { console.error(e); }
        return m.loadAnalysisJson("defense/points.json");
      })
      .then(function (j) {
        doc = j;
        buildBoth();
        buildStats();
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

    document.querySelectorAll("[data-sort]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (doc) sortSgg(b.dataset.sort);
      });
    });

  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
