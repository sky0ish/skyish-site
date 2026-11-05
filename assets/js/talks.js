/* ------------------------------------------------------------------
   첫 화면(index.html) 「Presentations」 — 최근 발표 몇 건만 보여 줍니다.

   전체 목록·검색·유튜브·주제별 통계는 따로 떨어진 게시판 presentations.html 에 있습니다.
   데이터는 assets/data/talks.js 의 window.TALKS.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var SHOW = 6;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function itemHtml(t) {
    return '<li class="pub">' +
        '<span class="pub__date">' + esc(t.date) + "</span>" +
        '<span class="pub__body">' +
          '<a class="pub__title" href="talk.html?k=' + encodeURIComponent(t.sort) + '">' + esc(t.title) +
            '<span class="pub__ext" aria-hidden="true">›</span></a>' +
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

    var items = talks.slice().sort(function (a, b) { return (b.sort || 0) - (a.sort || 0); });
    var years = items.map(function (t) { return String(t.sort).slice(0, 4); });

    mount.innerHTML =
      '<p class="talks-sum">총 <strong>' + items.length + "</strong>건 · " + esc(years[years.length - 1]) + "–" + esc(years[0]) +
        " · 최근 " + SHOW + "건</p>" +
      '<ol class="pub-list">' + items.slice(0, SHOW).map(itemHtml).join("") + "</ol>" +
      '<p class="talks-more" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:2rem">' +
        '<a class="btn btn--solid" href="presentations.html">전체 ' + items.length + '건 보기 · 검색 <span class="arrow" aria-hidden="true">→</span></a>' +
        '<a class="btn btn--ghost" href="presentations.html#analysis">주제별 통계 · 기관 연결망 <span class="arrow" aria-hidden="true">→</span></a>' +
      "</p>";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
