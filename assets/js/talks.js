/* ------------------------------------------------------------------
   대외 발표 목록 — about.html 의 #talks-board 를 채웁니다.

   assets/data/talks.js 의 window.TALKS 를 읽어 연도별로 묶어 그립니다.
   RESEARCH 목록(.pub-*)과 같은 마크업을 써서 스타일을 공유합니다.

   main.js 와 분리해 둔 이유: 다른 작업과 충돌하지 않도록.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function yearOf(t) {
    var m = /^(\d{4})/.exec(String(t.sort || t.date || ""));
    return m ? m[1] : "기타";
  }

  function itemHtml(t) {
    return '<li class="pub">' +
        '<span class="pub__date">' + esc(t.date) + "</span>" +
        '<span class="pub__body">' +
          '<span class="pub__title">' + esc(t.title) + "</span>" +
          (t.host ? '<span class="pub__meta">' + esc(t.host) + "</span>" : "") +
        "</span>" +
        (t.tag ? '<span class="pub__role">' + esc(t.tag) + "</span>" : "") +
      "</li>";
  }

  function render() {
    var mount = document.getElementById("talks-board");
    if (!mount) return;

    var talks = window.TALKS;
    if (!talks || !talks.length) {
      mount.innerHTML = '<p class="placeholder-note" lang="ko">발표 이력을 준비 중입니다.</p>';
      return;
    }

    var items = talks.slice().sort(function (a, b) {
      return (b.sort || 0) - (a.sort || 0);
    });

    // 연도별로 묶기 (최신 연도부터)
    var groups = {}, order = [];
    items.forEach(function (t) {
      var y = yearOf(t);
      if (!groups[y]) { groups[y] = []; order.push(y); }
      groups[y].push(t);
    });

    var years = order.filter(function (y) { return y !== "기타"; });
    var first = years.length ? years[years.length - 1] : "";
    var last  = years.length ? years[0] : "";

    var html =
      '<p class="talks-sum">총 <strong>' + items.length + "</strong>건" +
      (first && last ? " · " + esc(first) + "–" + esc(last) : "") + "</p>";

    html += order.map(function (y) {
      return '<div class="pub-subgroup">' +
          '<h3 class="pub-subgroup__title">' + esc(y) + " <span>" + groups[y].length + "</span></h3>" +
          '<ol class="pub-list">' + groups[y].map(itemHtml).join("") + "</ol>" +
        "</div>";
    }).join("");

    mount.innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
