/* ------------------------------------------------------------------
   발표 하나의 행사 개요 — talk.html?k=<sort>

   발표 목록(assets/data/talks.js 의 window.TALKS)에서 그 발표를 찾고,
   assets/data/talk-info.json 에서 행사 개요를 읽어 그립니다.
     · 개요는 1.세미나_토론\OLD 의 행사 폴더(개최계획·포스터·안내문·발표자료 표지)에서 옮겨 적었고,
       폴더에 없던 것은 웹의 행사 안내·보도자료·기사에서 찾았습니다.
     · 연락처·사례비 같은 것은 담지 않습니다.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var safeUrl = function (u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; };
  var ytId = function (u) {
    var m = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/live\/)([\w-]{11})/.exec(String(u || ""));
    return m ? m[1] : "";
  };

  function row(label, val) {
    return val ? "<dt>" + esc(label) + "</dt><dd>" + esc(val) + "</dd>" : "";
  }

  function personHtml(p) {
    var bits = [p.title, p.org].filter(Boolean).map(esc).join(" · ");
    return '<li class="tk-person' + (p.name === "남지현" ? " is-me" : "") + '">' +
      "<b>" + esc(p.name) + "</b>" + (bits ? "<span>" + bits + "</span>" : "") + "</li>";
  }

  var ROLE_ORDER = ["기조발제", "기조강연", "축사", "환영사", "개회사", "인사말", "사회", "좌장", "발제", "발표", "주제발표", "토론", "패널", "참석"];
  function peopleHtml(list) {
    var groups = {}, order = [];
    list.forEach(function (p) {
      if (!p || !p.name) return;
      var r = p.role || "함께한 분";
      if (!groups[r]) { groups[r] = []; order.push(r); }
      groups[r].push(p);
    });
    order.sort(function (a, b) {
      var ia = ROLE_ORDER.indexOf(a), ib = ROLE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return order.map(function (r) {
      return '<div class="tk-pgroup"><h3>' + esc(r) + ' <small>' + groups[r].length + "</small></h3>" +
        '<ul class="tk-people">' + groups[r].map(personHtml).join("") + "</ul></div>";
    }).join("");
  }

  function linksHtml(links) {
    var vids = [], rest = [];
    links.forEach(function (l) {
      var u = safeUrl(l.u);
      if (!u) return;
      (ytId(u) ? vids : rest).push(l);
    });
    var h = "";
    if (vids.length) {
      h += '<ul class="tk-vids">' + vids.map(function (l) {
        var id = ytId(l.u);
        return '<li><a href="' + esc(l.u) + '" target="_blank" rel="noopener">' +
          '<img src="https://i.ytimg.com/vi/' + esc(id) + '/mqdefault.jpg" alt="" loading="lazy" width="320" height="180" onerror="this.style.visibility=\'hidden\'">' +
          "<span>" + esc(l.t || "YouTube 영상") + "</span></a></li>";
      }).join("") + "</ul>";
    }
    if (rest.length) {
      h += '<ul class="tk-links">' + rest.map(function (l) {
        var meta = [l.src, (l.d || "").replace(/-/g, ".")].filter(Boolean).map(esc).join(" · ");
        return '<li><a href="' + esc(l.u) + '" target="_blank" rel="noopener">' + esc(l.t || l.u) + "</a>" +
          (meta ? "<small>" + meta + "</small>" : "") + "</li>";
      }).join("") + "</ul>";
    }
    return h;
  }

  function render(talks, infoAll) {
    var app = document.getElementById("tkApp");
    var k = (/[?&]k=(\d+)/.exec(location.search) || [])[1] || "";
    var list = talks.slice().sort(function (a, b) { return (b.sort || 0) - (a.sort || 0); });
    var i = -1;
    list.forEach(function (t, n) { if (String(t.sort) === k) i = n; });
    if (i < 0) {
      app.innerHTML = '<p class="tk-empty">그 발표를 찾지 못했습니다. <a href="index.html#talks">목록으로</a></p>';
      return;
    }
    var t = list[i], info = infoAll[String(t.sort)] || {};
    document.title = t.title + " — Jee-Hyun NAM";

    var has = info.event || info.when || info.where || info.host || info.about ||
              (info.program || []).length || (info.people || []).length || (info.links || []).length;

    var h = '<header class="tk-head">' +
      '<p class="tk-kicker"><span class="tk-tag">' + esc(t.tag || "발표") + "</span>" + esc(t.date) + "</p>" +
      '<h1 class="tk-title">' + esc(t.title) + "</h1>" +
      (t.host ? '<p class="tk-host">' + esc(t.host) + "</p>" : "") +
      "</header>";

    if (has) {
      var dl = row("행사명", info.event) + row("일시", info.when) + row("장소", info.where) +
               row("주최", info.host) + row("주관", info.org) + row("후원", info.support) + row("발표 형식", info.role);
      if (dl || info.about) {
        h += '<section class="tk-sec"><h2>행사 개요</h2>' +
          (dl ? '<dl class="tk-dl">' + dl + "</dl>" : "") +
          (info.about ? '<p class="tk-about">' + esc(info.about) + "</p>" : "") + "</section>";
      }
      if ((info.program || []).length) {
        h += '<section class="tk-sec"><h2>프로그램</h2><table class="tk-prog"><tbody>' +
          info.program.map(function (p) {
            return "<tr><th>" + esc(p.time || "") + "</th><td>" + esc(p.item || "") +
              (p.who ? '<span class="tk-who">' + esc(p.who) + "</span>" : "") + "</td></tr>";
          }).join("") + "</tbody></table></section>";
      }
      if ((info.people || []).length) {
        h += '<section class="tk-sec"><h2>함께한 분</h2>' + peopleHtml(info.people) + "</section>";
      }
      if ((info.links || []).length) {
        h += '<section class="tk-sec"><h2>관련 자료</h2>' + linksHtml(info.links) + "</section>";
      }
    } else {
      h += '<p class="tk-empty">이 발표의 행사 자료는 아직 정리하지 못했습니다.</p>';
    }

    var q = encodeURIComponent([t.host, t.title].filter(Boolean).join(" ").replace(/[「」·—()]/g, " ").replace(/\s+/g, " ").trim());
    h += '<p class="tk-more"><a href="https://search.naver.com/search.naver?where=news&amp;query=' + q +
         '" target="_blank" rel="noopener">네이버에서 이 행사 더 찾아보기 ↗</a></p>';

    var prev = list[i + 1], next = list[i - 1];
    h += '<nav class="tk-nav" aria-label="다른 발표">' +
      (next ? '<a class="tk-nav__next" href="talk.html?k=' + next.sort + '"><small>다음 발표 · ' + esc(next.date) + "</small>" + esc(next.title) + "</a>" : "<span></span>") +
      (prev ? '<a class="tk-nav__prev" href="talk.html?k=' + prev.sort + '"><small>이전 발표 · ' + esc(prev.date) + "</small>" + esc(prev.title) + "</a>" : "<span></span>") +
      "</nav>";

    app.innerHTML = h;
  }

  function start() {
    var talks = window.TALKS || [];
    fetch("assets/data/talk-info.json?v=" + Math.floor(Date.now() / 36e5), { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (info) { render(talks, info || {}); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
