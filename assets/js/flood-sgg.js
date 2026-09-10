/* =============================================================
   시군별 침수 반지하 · 침수흔적 면적 — flood-basement.html ④

   지도 ①이 읽은 source-<src>.json 을 그대로 써서
     · 시군별 침수흔적도 안 반지하 수   (bySgg 를 시군 단위로 합침 — 구는 시로)
     · 시군별 침수흔적 면적             (폴리곤을 시군별로 모아 겹침을 지운 넓이)
   를 셉니다.

   침수흔적도는 같은 자리가 해마다 따로 기록돼 있어, 면적 속성을 그냥 더하면
   파주가 463㎢ 처럼 시 넓이의 2/3 가 침수된 듯 나옵니다. 그래서 폴리곤을
   작은 격자(기본 20m)에 그려 **칠해진 칸만** 세는 방법으로 겹침을 지웁니다
   (canvas 래스터화 — 라이브러리 없이 브라우저만으로).

   화면이 없는 셈(sggOf · byCity · dissolveArea)은 _fbtest.html 로 시험합니다.
   ============================================================= */
(function () {
  "use strict";

  /* 경기도 시군 코드(앞 4자리 → 시). 구가 있는 시는 앞 4자리가 같습니다.
     41730 은 2013년 시로 승격하기 전의 여주군 — 옛 기록에 남아 있습니다. */
  var CITY = {
    "4111": "수원시", "4113": "성남시", "4115": "의정부시", "4117": "안양시", "4119": "부천시",
    "4121": "광명시", "4122": "평택시", "4125": "동두천시", "4127": "안산시", "4128": "고양시",
    "4129": "과천시", "4131": "구리시", "4136": "남양주시", "4137": "오산시", "4139": "시흥시",
    "4141": "군포시", "4143": "의왕시", "4145": "하남시", "4146": "용인시", "4148": "파주시",
    "4150": "이천시", "4155": "안성시", "4157": "김포시", "4159": "화성시", "4161": "광주시",
    "4163": "양주시", "4165": "포천시", "4167": "여주시", "4173": "여주시",
    "4180": "연천군", "4182": "가평군", "4183": "양평군"
  };

  /** 시군구 코드 → 시군 이름. 모르면 코드 그대로 */
  function sggOf(code) {
    var c = String(code || "");
    return CITY[c.slice(0, 4)] || (c ? "코드 " + c : "(미상)");
  }

  /** 「고양시 덕양구」 → 「고양시」 */
  function cityOf(name) {
    return String(name || "").split(/\s+/)[0] || "";
  }

  /* ---------- 겹침을 지운 넓이 (격자 칠하기) ---------- */
  var R2D = Math.PI / 180;

  /** 폴리곤 묶음의 겹침 없는 넓이(㎡).
   *  격자 한 칸을 cellM(m)로 두고, 긴 변이 maxPx 칸을 넘으면 칸을 키웁니다.
   *  @param features GeoJSON Feature (Polygon · MultiPolygon, 경위도)
   *  @returns { area, cell, w, h }  area 는 ㎡
   */
  function dissolveArea(features, cellM, maxPx) {
    var fs = features || [];
    if (!fs.length || typeof document === "undefined") return { area: 0, cell: 0, w: 0, h: 0 };
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var rings = [];
    fs.forEach(function (f) {
      var g = f.geometry || {};
      var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      polys.forEach(function (poly) {
        rings.push(poly);                       // [outer, hole, hole…]
        poly.forEach(function (ring) {
          ring.forEach(function (pt) {
            if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
          });
        });
      });
    });
    if (!rings.length || !isFinite(minX)) return { area: 0, cell: 0, w: 0, h: 0 };

    /* 경위도 → 미터 (가운데 위도 기준의 등거리 근사 — 시군 하나 크기에서는 충분합니다) */
    var lat0 = (minY + maxY) / 2, kx = Math.cos(lat0 * R2D) * 111320, ky = 111320;
    var spanX = (maxX - minX) * kx, spanY = (maxY - minY) * ky;
    var cell = cellM || 20, cap = maxPx || 4000;
    if (Math.max(spanX, spanY) / cell > cap) cell = Math.max(spanX, spanY) / cap;
    var w = Math.max(1, Math.ceil(spanX / cell)), h = Math.max(1, Math.ceil(spanY / cell));

    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#000";
    /* 겹침은 evenodd 가 아니라 nonzero 로 — 폴리곤끼리 겹쳐도 한 번만 칠해야 합니다.
       구멍(hole)은 같은 폴리곤 안에서만 뺍니다: 폴리곤마다 따로 그립니다. */
    rings.forEach(function (poly) {
      ctx.beginPath();
      poly.forEach(function (ring) {
        ring.forEach(function (pt, i) {
          var x = (pt[0] - minX) * kx / cell, y = (maxY - pt[1]) * ky / cell;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      });
      ctx.fill("evenodd");
    });
    /* 칸이 「얼마나」 칠해졌는지(알파)를 더합니다 — 칸보다 작은 폴리곤도
       테두리 번짐(안티에일리어싱)만큼은 세어져, 부천처럼 작은 구역이 흩어진 곳도 놓치지 않습니다. */
    var px = ctx.getImageData(0, 0, w, h).data, n = 0;
    for (var i = 3; i < px.length; i += 4) n += px[i];
    return { area: n / 255 * cell * cell, cell: cell, w: w, h: h };
  }

  /* ---------- 시군별 표 ---------- */
  /** @param source  source-<src>.json
   *  @param set     "est" | "srv"
   *  @param opt     { cellM }
   *  @returns [{ city, total, inside, ratio, polygons, areaSum, area }] — inside 많은 차례
   *           areaSum 은 속성 면적의 합(연도 중복 포함), area 는 겹침 지운 넓이 (둘 다 ㎡)
   */
  function byCity(source, set, opt) {
    var rows = {};
    function row(city) {
      return rows[city] || (rows[city] = { city: city, total: 0, inside: 0, polygons: 0, areaSum: 0, area: 0, feats: [] });
    }
    ((source.bySgg || {})[set] || []).forEach(function (r) {
      var x = row(cityOf(r.sgg));
      x.total += Number(r.total) || 0;
      x.inside += Number(r.inside) || 0;
    });
    (((source.geojson || {}).features) || []).forEach(function (f) {
      var p = f.properties || {}, x = row(sggOf(p.sgg_cd));
      x.polygons++;
      x.areaSum += Number(p.area) || 0;
      x.feats.push(f);
    });
    var cell = (opt && opt.cellM) || 20;
    return Object.keys(rows).map(function (k) {
      var x = rows[k];
      x.area = x.feats.length ? dissolveArea(x.feats, cell).area : 0;
      delete x.feats;
      x.ratio = x.total ? x.inside / x.total * 100 : 0;
      return x;
    }).sort(function (a, b) { return b.inside - a.inside || b.area - a.area || a.city.localeCompare(b.city, "ko"); });
  }

  window.FloodSgg = { CITY: CITY, sggOf: sggOf, cityOf: cityOf, dissolveArea: dissolveArea, byCity: byCity };
})();
