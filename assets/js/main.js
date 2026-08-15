/* =============================================================
   Jee-Hyun NAM — site scripts
   Shared header/footer are generated here so you edit them ONCE.
   Everything works when opened directly from disk (file://) — no
   server, no build step, no external dependency except Google Fonts.
   ============================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------------
     1. SITE CONFIG  — edit your nav, name and contact here.
        `file` is matched against the current page to highlight
        the active menu item.
     ----------------------------------------------------------- */
  var SITE = {
    brand: "Jee-Hyun NAM",
    tagline: "Architecture · Urban Design",
    /* `sub` 가 있으면 마우스를 올렸을 때 펼쳐지는 아래 차림표가 생깁니다.
       `also` 는 그 메뉴에 속한 다른 화면들 — 지금 보고 있는 쪽을 밝혀 줍니다. */
    nav: [
      { label: "HOME",     file: "index.html"    },
      { label: "ABOUT",    file: "about.html", sub: [
        { label: "Education",     file: "about.html#education"  },
        { label: "Career",        file: "about.html#career"     },
        { label: "Awards",        file: "about.html#awards"     },
        { label: "Committees",    file: "about.html#committees" },
        { label: "Presentations", file: "about.html#talks"      }
      ] },
      { label: "RESEARCH", file: "works.html", sub: [
        { label: "Journals",   file: "works.html?tab=papers"  },
        { label: "Reports",    file: "works.html?tab=reports" },
        { label: "이슈 대응",  file: "works.html?tab=issues"  },
        { label: "학위논문",   file: "works.html?tab=theses"  }
      ] },
      { label: "DATA ANALYSIS", file: "pictures.html",
        also: ["defense-cluster.html", "flood-basement.html"], sub: [
        { label: "방위산업 클러스터", file: "defense-cluster.html" },
        { label: "침수 반지하",      file: "flood-basement.html" }
      ] },
      { label: "TRAVEL",   file: "travel.html", also: ["travel-post.html"] },
      { label: "MAP",      file: "map.html", sub: [
        { label: "핫플",     file: "map.html?g=hot"    },
        { label: "도시건축", file: "map.html?g=urban"  },
        { label: "부동산",   file: "map.html?g=estate" }
      ] },
      { label: "BLOG",     file: "blog.html"     },
      { label: "CONTACT",  file: "contact.html"  }
    ],
    email: "whlove@gmail.com",
    org:   "Gyeonggi Research Institute"
  };

  /* -----------------------------------------------------------
     2. Helpers
     ----------------------------------------------------------- */
  function currentFile() {
    var path = location.pathname.split("/").pop();
    return path && path.length ? path : "index.html";
  }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) { for (var k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); } }
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* -----------------------------------------------------------
     3. Header
     ----------------------------------------------------------- */
  function buildHeader() {
    var mount = document.getElementById("site-header");
    if (!mount) return;
    var here = currentFile();

    var header = el("header", { class: "site-header" });
    var inner  = el("div", { class: "container" });
    var bar    = el("div", { class: "site-header__inner" });

    var brand = el("a", { href: "index.html", class: "brand", "aria-label": SITE.brand });
    brand.innerHTML = SITE.brand + "<small>" + SITE.tagline + "</small>";

    var nav = el("nav", { class: "nav", "aria-label": "Main" });
    SITE.nav.forEach(function (item, idx) {
      /* 지금 이 화면 자체인가 / 이 메뉴에 딸린 다른 화면인가를 나눕니다.
         aria-current="page" 는 '이 링크가 지금 문서'일 때만 붙여야 하므로,
         딸린 화면일 때는 밑줄만 켜는 표시(is-here)를 씁니다. */
      var isSelf  = item.file === here;
      var inGroup = isSelf || (item.also || []).indexOf(here) >= 0;

      function markHere(node) {
        if (isSelf) node.setAttribute("aria-current", "page");
        else if (inGroup) node.classList.add("is-here");
      }

      if (!item.sub) {
        var plain = el("a", { href: item.file }, item.label);
        markHere(plain);
        nav.appendChild(plain);
        return;
      }

      /* 아래로 펼쳐지는 차림표 — 마우스를 올리거나 단추를 누르면 열립니다 */
      var id = "nav-sub-" + idx;
      var group = el("div", { class: "nav__group" });
      var a = el("a", { href: item.file, class: "nav__top" }, item.label);
      markHere(a);

      var open = el("button", {
        class: "nav__caret", type: "button",
        "aria-label": item.label + " 하위 메뉴", "aria-expanded": "false",
        "aria-controls": id
      }, '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>');

      var sub = el("div", { class: "nav__sub", id: id });
      var subin = el("div", { class: "nav__subin" });   // 서랍에서 접었다 펴는 데 쓰입니다
      item.sub.forEach(function (s) {
        subin.appendChild(el("a", { href: s.file }, s.label));
      });
      sub.appendChild(subin);

      open.addEventListener("click", function (e) {
        e.preventDefault();
        var was = group.classList.contains("is-open");
        closeGroups();
        group.classList.toggle("is-open", !was);
        open.setAttribute("aria-expanded", was ? "false" : "true");
      });

      group.appendChild(a);
      group.appendChild(open);
      group.appendChild(sub);
      nav.appendChild(group);
    });

    function closeGroups() {
      [].forEach.call(nav.querySelectorAll(".nav__group.is-open"), function (g) {
        g.classList.remove("is-open");
        var b = g.querySelector(".nav__caret");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    }
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) closeGroups();
    });

    var toggle = el("button", {
      class: "nav-toggle", "aria-label": "Toggle menu",
      "aria-expanded": "false", "aria-controls": "primary-nav"
    }, "<span></span><span></span><span></span>");
    nav.id = "primary-nav";

    bar.appendChild(brand);
    bar.appendChild(nav);
    bar.appendChild(toggle);
    inner.appendChild(bar);
    // Skip-to-content link (first focusable element) — WCAG 2.4.1
    var skip = el("a", { class: "skip-link", href: "#main" }, "본문 바로가기");
    header.appendChild(skip);
    header.appendChild(inner);
    mount.replaceWith(header);

    /* mobile menu (with focus management) */
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var first = nav.querySelector("a"); if (first) first.focus(); }
      else { toggle.focus(); }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        closeGroups();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closeGroups();
      if (document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });

    /* solid vs transparent — inner pages (no hero) start solid */
    var hasHero = document.body.hasAttribute("data-hero");
    function onScroll() {
      var solid = !hasHero || window.scrollY > 40;
      header.classList.toggle("is-solid", solid);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* -----------------------------------------------------------
     4. Footer
     ----------------------------------------------------------- */
  function buildFooter() {
    var mount = document.getElementById("site-footer");
    if (!mount) return;
    var year = new Date().getFullYear();

    var navLinks = SITE.nav.map(function (i) {
      return '<a href="' + i.file + '">' + i.label + "</a>";
    }).join("");

    var footer = el("footer", { class: "site-footer" });
    footer.innerHTML =
      '<div class="container">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' + SITE.brand +
            '<p>Researcher in Architecture &amp; Urban Design. ' +
            'A person who likes laughing, studying, chatting, sharing and challenging.</p>' +
          "</div>" +
          '<div class="footer-col"><h4>Explore</h4>' + navLinks + "</div>" +
          '<div class="footer-col"><h4>Contact</h4>' +
            '<a href="mailto:' + SITE.email + '">' + SITE.email + "</a>" +
            "<p>" + SITE.org + "</p>" +
          "</div>" +
        "</div>" +
        '<div class="footer-bottom">' +
          "<span>© " + year + " Jee-Hyun NAM · Street Life. Self-hosted.</span>" +
          '<span class="socials">' +
            '<a href="mailto:' + SITE.email + '">Email</a>' +
            '<a href="#top">Back to top ↑</a>' +
          "</span>" +
        "</div>" +
      "</div>";
    mount.replaceWith(footer);
  }

  /* -----------------------------------------------------------
     5. Back-to-top button
     ----------------------------------------------------------- */
  function buildToTop() {
    var btn = el("button", { class: "to-top", "aria-label": "Back to top" }, "↑");
    document.body.appendChild(btn);
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("scroll", function () {
      btn.classList.toggle("show", window.scrollY > 600);
    }, { passive: true });
  }

  /* -----------------------------------------------------------
     6. Hero rotating tagline
        <span data-rotator data-words="a,b,c"></span>
     ----------------------------------------------------------- */
  function heroRotator() {
    var node = document.querySelector("[data-rotator]");
    if (!node) return;
    var words = (node.getAttribute("data-words") || "").split(",")
      .map(function (w) { return w.trim(); }).filter(Boolean);
    if (!words.length) return;
    node.textContent = words[0];

    // Respect reduced-motion: show one word, no auto-rotation (WCAG 2.3.3).
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var i = 0, timer = null;
    node.classList.add("swap");
    function tick() {
      i = (i + 1) % words.length;
      node.classList.remove("swap");
      void node.offsetWidth;              // restart animation
      node.textContent = words[i];
      node.classList.add("swap");
    }
    function play() { if (!timer) timer = window.setInterval(tick, 2200); }
    function pause() { if (timer) { window.clearInterval(timer); timer = null; } }
    play();

    // Pausable per WCAG 2.2.2 — hover or keyboard-focus the tagline to pause.
    var host = node.closest(".hero__rotator") || node;
    host.setAttribute("tabindex", "0");
    host.setAttribute("aria-label", "Rotating tagline — hover or focus to pause");
    host.addEventListener("mouseenter", pause);
    host.addEventListener("mouseleave", play);
    host.addEventListener("focusin", pause);
    host.addEventListener("focusout", play);
  }

  /* -----------------------------------------------------------
     7. Scroll reveal — scroll-based so it works reliably
        everywhere (no dependency on IntersectionObserver timing).
     ----------------------------------------------------------- */
  function scrollReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!items.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { items.forEach(function (n) { n.classList.add("in"); }); return; }

    function check() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      for (var i = items.length - 1; i >= 0; i--) {
        var b = items[i].getBoundingClientRect();
        if (b.top < vh * 0.9 && b.bottom > 0) {
          items[i].classList.add("in");
          items.splice(i, 1);
        }
      }
    }
    check();                                   // reveal anything above the fold
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    window.addEventListener("load", check);
    // safety re-checks after fonts/images shift the layout
    setTimeout(check, 400);
    setTimeout(check, 1400);
  }

  /* -----------------------------------------------------------
     8a. Blog posts — rendered from window.POSTS (assets/data/posts.js)
         새 글은 posts.js 배열에 항목 하나 추가하면 됩니다.
     ----------------------------------------------------------- */
  function blogPosts() {
    var mount = document.getElementById("blog-posts");
    if (!mount || !window.POSTS) return;
    mount.innerHTML = window.POSTS.map(function (p) {
      var cats = (p.cats || []).join(",");
      var meta = '<div class="post__meta">' +
        (p.catLabel ? '<span class="tag">' + escapeHtml(p.catLabel) + '</span><span class="dot"></span>' : "") +
        "<span>Jeehyun NAM</span><span class=\"dot\"></span><span>" + escapeHtml(p.date) + "</span></div>";
      var full = p.body
        ? '<div class="post__full">' + p.body + "</div>" +
          '<button class="post__toggle" aria-expanded="false"><span class="label">더 읽기</span> <span class="arrow">→</span></button>'
        : "";
      return '<article class="post" data-cats="' + cats + '">' + meta +
        "<h2>" + escapeHtml(p.title) + "</h2>" +
        (p.excerpt ? '<p class="post__excerpt">' + escapeHtml(p.excerpt) + "</p>" : "") +
        full + "</article>";
    }).join("");
    var c = document.getElementById("blog-count");
    if (c) c.innerHTML = "전체 <strong>" + window.POSTS.length + "</strong>개 글";
  }

  /* -----------------------------------------------------------
     8b. Travel 게시판 — window.TRAVEL_POSTS (assets/data/travel.js)
         목록은 최신순, pinned 글은 항상 맨 위.
         "글쓰기" 버튼 → 폼 작성 → 붙여넣을 코드 자동 생성.
     ----------------------------------------------------------- */
  function travelBoard() {
    var mount = document.getElementById("travel-board");
    if (!mount) return;
    var posts = (window.TRAVEL_POSTS || []).slice().sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (b.sort || 0) - (a.sort || 0);
    });
    window.__tbOrder = posts;   // rendered order — used by the map to match rows

    var rows = posts.map(function (p, i) {
      var num = p.pinned ? '<span class="tb__pin">공지</span>' : (posts.length - i);
      var readable = !!p.body;
      var badges = (p.map ? ' <span class="tb__file">지도</span>' : "") +
        (/<img/.test(p.body || "") ? ' <span class="tb__file is-photo">사진</span>' : "");
      var title = escapeHtml(p.title) + badges;
      var titleCell = readable
        ? '<a class="tb__link" href="travel-post.html?p=' + encodeURIComponent(p.slug || i) + '">' + title + "</a>"
        : "<span>" + title + "</span>";
      return '<li class="tb__row' + (p.pinned ? " is-pinned" : "") + '">' +
          '<span class="tb__num">' + num + "</span>" +
          '<span class="tb__main">' +
            '<span class="tb__title">' + titleCell + "</span>" +
            (p.summary ? '<span class="tb__summary">' + escapeHtml(p.summary) + "</span>" : "") +
          "</span>" +
          (p.place ? '<span class="tb__place">' + escapeHtml(p.place) + "</span>" : "<span></span>") +
          '<span class="tb__date">' + escapeHtml(p.date || "") + "</span>" +
        "</li>";
    }).join("");

    mount.innerHTML =
      '<div class="tb__bar">' +
        '<span class="tb__count">전체 <strong>' + posts.length + "</strong>건</span>" +
        '<button class="btn btn--teal tb__write" type="button">✎ 글쓰기</button>' +
      "</div>" +
      '<ul class="tb">' +
        '<li class="tb__head"><span>번호</span><span>제목</span><span>지역</span><span>날짜</span></li>' +
        rows +
      "</ul>" +
      '<div class="tb__form" hidden>' +
        "<h3>새 글 쓰기</h3>" +
        '<div class="field"><label for="tw-title">제목</label><input id="tw-title" type="text" placeholder="예: 이탈리아 여행"></div>' +
        '<div class="tb__form-row">' +
          '<div class="field"><label for="tw-date">날짜</label><input id="tw-date" type="text" placeholder="2026.08"></div>' +
          '<div class="field"><label for="tw-place">지역</label><input id="tw-place" type="text" placeholder="Italy"></div>' +
        "</div>" +
        '<div class="field"><label for="tw-summary">소개</label><textarea id="tw-summary" placeholder="한두 줄 소개를 적어주세요"></textarea></div>' +
        '<div class="field"><label for="tw-file">PDF 파일명 (선택)</label><input id="tw-file" type="text" placeholder="assets/travel/파일명.pdf"></div>' +
        '<div class="tb__form-actions">' +
          '<button class="btn btn--solid tb__make" type="button">코드 만들기</button>' +
          '<button class="btn btn--ghost tb__cancel" type="button">닫기</button>' +
        "</div>" +
        '<div class="tb__out" hidden>' +
          '<p class="tb__hint">아래 코드를 <code>assets/data/travel.js</code>의 <code>window.TRAVEL_POSTS = [</code> 바로 다음 줄에 붙여넣으면 글이 올라갑니다.</p>' +
          "<pre><code></code></pre>" +
          '<button class="btn btn--teal tb__copy" type="button">복사하기</button>' +
        "</div>" +
      "</div>";

    var form = mount.querySelector(".tb__form");
    var out = mount.querySelector(".tb__out");
    var pre = out.querySelector("code");
    function val(id) { return (mount.querySelector("#" + id) || {}).value || ""; }

    mount.querySelector(".tb__write").addEventListener("click", function () {
      form.hidden = !form.hidden;
      if (!form.hidden) mount.querySelector("#tw-title").focus();
    });
    mount.querySelector(".tb__cancel").addEventListener("click", function () { form.hidden = true; });
    mount.querySelector(".tb__make").addEventListener("click", function () {
      var title = val("tw-title").trim() || "제목 없음";
      var date = val("tw-date").trim();
      var place = val("tw-place").trim();
      var summary = val("tw-summary").trim();
      var file = val("tw-file").trim();
      var sort = (date.replace(/[^0-9]/g, "") + "0000").slice(0, 6) || "000000";
      var code = "  {\n" +
        "    sort: " + parseInt(sort, 10) + ",\n" +
        '    date: "' + date + '", title: "' + title + '", place: "' + place + '",\n' +
        '    summary: "' + summary.replace(/"/g, '\\"') + '"' +
        (file ? ',\n    file: "' + file + '"' : "") + "\n" +
        "  },";
      pre.textContent = code;
      out.hidden = false;
    });
    mount.querySelector(".tb__copy").addEventListener("click", function (e) {
      var btn = e.currentTarget;
      var text = pre.textContent;
      function done() { btn.textContent = "복사됨 ✓"; setTimeout(function () { btn.textContent = "복사하기"; }, 1600); }
      if (navigator.clipboard) { navigator.clipboard.writeText(text).then(done, done); }
      else {
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (err) {}
        document.body.removeChild(ta); done();
      }
    });
  }

  /* -----------------------------------------------------------
     8b-2. Shared zoom / pan for any map SVG.
           Returns { reset, zoomTo } and injects +/−/전체 controls.
     ----------------------------------------------------------- */
  function enableMapZoom(svg, host, baseW, baseH, opts) {
    opts = opts || {};
    var BASE = { x: 0, y: 0, w: baseW, h: baseH };
    var ratio = baseH / baseW;
    var view = { x: 0, y: 0, w: baseW, h: baseH };
    var MIN_W = baseW * (opts.maxZoom ? 1 / opts.maxZoom : 0.08);

    function apply() { svg.setAttribute("viewBox", view.x + " " + view.y + " " + view.w + " " + view.h); }
    function clamp() {
      view.w = Math.max(MIN_W, Math.min(baseW, view.w));
      view.h = view.w * ratio;
      view.x = Math.max(-view.w * 0.15, Math.min(BASE.w - view.w * 0.85, view.x));
      view.y = Math.max(-view.h * 0.15, Math.min(BASE.h - view.h * 0.85, view.y));
      var z = baseW / view.w;                       // current zoom factor
      // counter-scale so labels / dots keep a constant on-screen size
      svg.style.setProperty("--k", (1 / z).toFixed(4));
      svg.classList.toggle("z-mid", z >= 2.5);      // building dots become visible
      svg.classList.toggle("z-near", z >= 4);       // building labels appear
    }
    function zoomAt(f, cx, cy) {
      var nw = Math.max(MIN_W, Math.min(baseW, view.w * f));
      var s = nw / view.w;
      view.x = cx - (cx - view.x) * s;
      view.y = cy - (cy - view.y) * s;
      view.w = nw; clamp(); apply();
    }
    function pt(evt) {
      var r = svg.getBoundingClientRect();
      var sc = Math.min(r.width / view.w, r.height / view.h);
      var ox = (r.width - view.w * sc) / 2, oy = (r.height - view.h * sc) / 2;
      return { x: view.x + (evt.clientX - r.left - ox) / sc, y: view.y + (evt.clientY - r.top - oy) / sc };
    }
    function reset() { view = { x: 0, y: 0, w: baseW, h: baseH }; clamp(); apply(); }
    function zoomTo(cx, cy, w) {
      view.w = Math.max(MIN_W, Math.min(baseW, w));
      view.h = view.w * ratio;
      view.x = cx - view.w / 2; view.y = cy - view.h / 2;
      clamp(); apply();
    }
    clamp(); apply();

    var ctrl = el("div", { class: "tmap__zoom" },
      '<button type="button" data-z="in" aria-label="확대">+</button>' +
      '<button type="button" data-z="out" aria-label="축소">−</button>' +
      '<button type="button" data-z="fit" aria-label="전체 보기">전체</button>');
    host.appendChild(ctrl);
    ctrl.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      e.stopPropagation();
      var k = b.getAttribute("data-z");
      if (k === "fit") return reset();
      zoomAt(k === "in" ? 0.7 : 1 / 0.7, view.x + view.w / 2, view.y + view.h / 2);
    });

    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      var p = pt(e); zoomAt(e.deltaY < 0 ? 0.88 : 1 / 0.88, p.x, p.y);
    }, { passive: false });

    var dragging = false, last = null;
    svg.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".tmap__pin")) return;
      dragging = true; last = { x: e.clientX, y: e.clientY };
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      svg.classList.add("is-grabbing");
    });
    svg.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var r = svg.getBoundingClientRect();
      var sc = Math.min(r.width / view.w, r.height / view.h);
      view.x -= (e.clientX - last.x) / sc; view.y -= (e.clientY - last.y) / sc;
      last = { x: e.clientX, y: e.clientY };
      clamp(); apply();
    });
    function end(e) {
      if (!dragging) return;
      dragging = false; svg.classList.remove("is-grabbing");
      try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("dblclick", function (e) { var p = pt(e); zoomAt(0.6, p.x, p.y); });

    return { reset: reset, zoomTo: zoomTo };
  }

  /* -----------------------------------------------------------
     8b-3. Single travel post page (travel-post.html?p=slug)
     ----------------------------------------------------------- */
  function travelPostPage() {
    var mount = document.getElementById("travel-post");
    if (!mount || !window.TRAVEL_POSTS) return;
    var posts = window.TRAVEL_POSTS;
    var key = decodeURIComponent((location.search.match(/[?&]p=([^&]*)/) || [])[1] || "");
    var idx = -1;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].slug === key || String(i) === key) { idx = i; break; }
    }
    if (idx < 0) {
      mount.innerHTML = '<p class="placeholder-note" lang="ko">글을 찾을 수 없습니다. ' +
        '<a href="travel.html">목록으로 돌아가기</a></p>';
      return;
    }
    var p = posts[idx];
    var col = ((window.TRAVEL_PLACES || {})[postCountries(p)[0]] || {}).color;
    document.title = p.title + " — Jee-Hyun NAM";

    // ordered list without the pinned notice, for prev/next
    var prev = posts[idx - 1], next = posts[idx + 1];
    function navLink(q, label, side) {
      if (!q) return '<span class="tpost__navitem is-off">' + label + "</span>";
      return '<a class="tpost__navitem is-' + side + '" href="travel-post.html?p=' +
        encodeURIComponent(q.slug) + '"><span class="tpost__navlabel">' + label +
        '</span><span class="tpost__navtitle">' + escapeHtml(q.title) + "</span></a>";
    }

    // 지도는 제목 위에 화면 폭 가득(full-bleed)으로 먼저 놓입니다
    var mapBlock = p.map
      ? '<div class="tpost__mapwrap">' +
          '<a class="tpost__back tpost__back--over" href="travel.html">← 목록</a>' +
          '<div class="tmap__detail" id="tpost-map"></div>' +
        "</div>"
      : "";

    mount.innerHTML =
      mapBlock +
      '<article class="tpost">' +
        '<header class="tpost__head">' +
          (p.map ? "" : '<a class="tpost__back" href="travel.html">← 목록</a>') +
          '<div class="tpost__meta">' +
            '<span class="tpost__date">' + escapeHtml(p.date || "") + "</span>" +
            (p.place ? '<span class="tpost__place">' + escapeHtml(p.place) + "</span>" : "") +
          "</div>" +
          "<h1>" + escapeHtml(p.title) + "</h1>" +
          (p.summary ? '<p class="tpost__summary">' + escapeHtml(p.summary) + "</p>" : "") +
        "</header>" +
        '<div class="tpost__body tb__article">' + (p.body || "") + "</div>" +
        '<nav class="tpost__nav">' + navLink(prev, "이전 글", "prev") + navLink(next, "다음 글", "next") + "</nav>" +
        '<p class="tpost__foot"><a class="btn btn--ghost" href="travel.html">목록으로</a></p>' +
      "</article>";

    if (p.map) renderDetailMap(document.getElementById("tpost-map"), p.map, col);
    if (p.slug === "checklist" || p.checklist) {
      setupChecklist(mount.querySelector(".tpost__body"), "travel-checklist:" + p.slug);
    }
  }

  /* -----------------------------------------------------------
     8b-4. Interactive packing checklist
           체크 상태는 이 브라우저에 저장됩니다 (localStorage).
     ----------------------------------------------------------- */
  function setupChecklist(root, storeKey) {
    if (!root) return;
    var items = [].slice.call(root.querySelectorAll("li"))
      .filter(function (li) { return !li.querySelector("ul, ol"); });
    if (!items.length) return;

    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(storeKey) || "{}") || {}; } catch (e) { saved = {}; }

    root.classList.add("tcheck");
    items.forEach(function (li, i) {
      var id = storeKey + "#" + i;
      var text = li.innerHTML;
      li.classList.add("tcheck__item");
      li.innerHTML = '<label><input type="checkbox" data-i="' + i + '"' +
        (saved[i] ? " checked" : "") + '><span>' + text + "</span></label>";
      if (saved[i]) li.classList.add("is-done");
    });

    var bar = el("div", { class: "tcheck__bar" },
      '<span class="tcheck__count"></span>' +
      '<span class="tcheck__actions">' +
        '<button type="button" class="tcheck__all">전체 선택</button>' +
        '<button type="button" class="tcheck__reset">전체 해제</button>' +
      "</span>");
    root.insertBefore(bar, root.firstChild);

    var countEl = bar.querySelector(".tcheck__count");
    function persist() {
      var o = {};
      items.forEach(function (li, i) { if (li.querySelector("input").checked) o[i] = 1; });
      try { localStorage.setItem(storeKey, JSON.stringify(o)); } catch (e) {}
    }
    function refresh() {
      var done = items.filter(function (li) { return li.querySelector("input").checked; }).length;
      countEl.innerHTML = "<strong>" + done + "</strong> / " + items.length + " 준비 완료";
      bar.classList.toggle("is-complete", done === items.length && items.length > 0);
    }
    root.addEventListener("change", function (e) {
      var cb = e.target.closest('input[type="checkbox"]');
      if (!cb) return;
      cb.closest("li").classList.toggle("is-done", cb.checked);
      persist(); refresh();
    });
    function setAll(v) {
      items.forEach(function (li) {
        li.querySelector("input").checked = v;
        li.classList.toggle("is-done", v);
      });
      persist(); refresh();
    }
    bar.querySelector(".tcheck__all").addEventListener("click", function () { setAll(true); });
    bar.querySelector(".tcheck__reset").addEventListener("click", function () { setAll(false); });
    refresh();
  }

  /* -----------------------------------------------------------
     8c. Travel world map — grayscale map + colored pins per country.
         Pin click → filters/scrolls the board below.
     ----------------------------------------------------------- */
  /* 한 게시글이 여러 나라에 걸칠 수 있습니다 (예: 영국+독일).
     countries 배열이 있으면 그것을, 없으면 country 하나를 씁니다. */
  function postCountries(p) {
    if (!p) return [];
    if (p.countries && p.countries.length) return p.countries;
    return p.country ? [p.country] : [];
  }

  function travelMap() {
    var host = document.getElementById("travel-map");
    if (!host || !window.TRAVEL_PLACES) return;
    var places = window.TRAVEL_PLACES;
    var posts = window.TRAVEL_POSTS || [];

    // how many posts per country (한 여행이 여러 나라에 걸치면 모두 집계)
    var counts = {};
    posts.forEach(function (p) {
      postCountries(p).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
    });

    var W = 2000, H = 1000;
    function px(lon) { return (lon + 180) * (W / 360); }
    function py(lat) { return (90 - lat) * (H / 180); }

    fetch("assets/img/world-a-dotted.svg").then(function (r) {
      if (!r.ok) throw new Error("map missing");
      return r.text();
    }).then(function (svgText) {
      host.innerHTML = '<div class="tmap__wrap">' + svgText + "</div>";
      var svg = host.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("class", "tmap__svg");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");   // 전체 지도가 보이도록
      var pins = svg.querySelector("#pins") || svg;

      var NS = "http://www.w3.org/2000/svg";
      var legend = document.getElementById("travel-legend") || host.appendChild(el("ul", { class: "tmap__legend" }));

      Object.keys(places).forEach(function (key) {
        var pl = places[key];
        var n = counts[key] || 0;
        if (!n) return;
        var cx = px(pl.lon), cy = py(pl.lat);

        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "tmap__pin");
        g.setAttribute("data-country", key);
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", pl.label + " 여행 기록 " + n + "건 보기");

        var halo = document.createElementNS(NS, "circle");
        halo.setAttribute("cx", cx); halo.setAttribute("cy", cy);
        halo.setAttribute("r", 26); halo.setAttribute("fill", pl.color);
        halo.setAttribute("class", "tmap__halo");

        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
        dot.setAttribute("r", 11); dot.setAttribute("fill", pl.color);
        dot.setAttribute("stroke", "#fff"); dot.setAttribute("stroke-width", "3");
        dot.setAttribute("class", "tmap__dot");

        var title = document.createElementNS(NS, "title");
        title.textContent = pl.label + " · " + n + "건";

        g.appendChild(halo); g.appendChild(dot); g.appendChild(title);
        pins.appendChild(g);

        var li = document.createElement("li");
        li.innerHTML = '<button type="button" data-country="' + key + '">' +
          '<span class="tmap__swatch" style="background:' + pl.color + '"></span>' +
          escapeHtml(pl.label) + ' <span class="tmap__n">' + n + "</span></button>";
        legend.appendChild(li);
      });

      var zoomer = enableMapZoom(svg, host, 2000, 1000, { maxZoom: 8 });

      function focusCountry(key) {
        var board = document.getElementById("travel-board");
        if (!board) return;
        // highlight matching rows
        var rows = [].slice.call(board.querySelectorAll(".tb__row"));
        var first = null;
        rows.forEach(function (row, i) {
          var post = (window.__tbOrder || [])[i];
          var match = post && postCountries(post).indexOf(key) >= 0;
          row.classList.toggle("is-hit", !!match);
          if (match && !first) first = row;
        });
        host.querySelectorAll(".tmap__pin").forEach(function (p) {
          p.classList.toggle("is-active", p.getAttribute("data-country") === key);
        });
        legend.querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("is-active", b.getAttribute("data-country") === key);
        });
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      var scope = host.closest(".page-banner") || document;
      scope.addEventListener("click", function (e) {
        var pin = e.target.closest(".tmap__pin, .tmap__legend button");
        if (!pin) return;
        focusCountry(pin.getAttribute("data-country"));
      });
      scope.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var pin = e.target.closest(".tmap__pin");
        if (!pin) return;
        e.preventDefault();
        focusCountry(pin.getAttribute("data-country"));
      });
    }).catch(function () {
      host.innerHTML = '<p class="placeholder-note" lang="ko">세계지도를 준비 중입니다.</p>';
    });
  }

  /* -----------------------------------------------------------
     8d. Per-post detail map — draws the country map with pins for
         each visited city (post.map = {svg, bounds, cities:[...]})
     ----------------------------------------------------------- */
  /* 장소 종류별 색 — 본문 번호 뱃지와 지도 마커가 같은 색을 씁니다 */
  var KIND = {
    sight: { color: "#8c5cc8", label: "명소·건축" },
    food:  { color: "#e8a33a", label: "식당·카페" },
    hotel: { color: "#e0463c", label: "숙소" },
    shop:  { color: "#3f74d6", label: "상점" }
  };
  function kindOf(k) { return KIND[k] || KIND.sight; }

  /* 본문에서 같은 이름의 장소 항목을 찾아 스크롤 + 강조 */
  function focusPlaceInBody(name) {
    var body = document.querySelector(".tpost__body");
    if (!body || !name) return false;
    function norm(s) {
      return String(s).replace(/\s+/g, "").replace(/[()（）·・,，.]/g, "").toLowerCase();
    }
    var target = norm(name);
    var items = [].slice.call(body.querySelectorAll("ol.tplaces > li"));
    var hit = null;
    for (var i = 0; i < items.length; i++) {
      var st = items[i].querySelector("strong");
      if (!st) continue;
      var t = norm(st.textContent);
      if (t === target || t.indexOf(target) === 0 || target.indexOf(t) === 0) { hit = items[i]; break; }
    }
    if (!hit) {
      for (var j = 0; j < items.length; j++) {
        var s2 = items[j].querySelector("strong");
        if (s2 && norm(s2.textContent).indexOf(target) > -1) { hit = items[j]; break; }
      }
    }
    if (!hit) return false;
    body.querySelectorAll(".is-focus").forEach(function (n) { n.classList.remove("is-focus"); });
    hit.classList.add("is-focus");
    // 고정 헤더(76px)를 감안해 화면 중앙에 오도록 직접 계산
    var r = hit.getBoundingClientRect();
    var y = r.top + window.pageYOffset - Math.max(90, (window.innerHeight - r.height) / 2);
    try { window.scrollTo({ top: y, behavior: "smooth" }); }
    catch (e) { window.scrollTo(0, y); }
    setTimeout(function () { hit.classList.remove("is-focus"); }, 2600);
    return true;
  }

  /* Real slippy map (Leaflet + OSM/Carto tiles) — zoom in to building level. */
  function renderRealMap(container, cfg, color) {
    if (!container || !cfg || typeof L === "undefined") return false;
    var col = color || "#8c5cc8";
    var cities = cfg.cities || [];
    var blds = cfg.buildings || [];
    if (!cities.length && !blds.length) return false;

    container.innerHTML = '<div class="tmap__real"></div>' +
      '<p class="tmap__hint">휠·드래그로 이동, 확대하면 건물·도로까지 보입니다. 점을 누르면 장소 이름이 나옵니다.</p>' +
      '<ul class="tmap__cities"></ul>';
    var el2 = container.querySelector(".tmap__real");

    var map = L.map(el2, { scrollWheelZoom: true, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    var pts = [];
    var used = {};
    blds.forEach(function (b) {
      var kd = kindOf(b.kind);
      used[b.kind || "sight"] = 1;
      var m = L.circleMarker([b.lat, b.lon], {
        radius: b.kind && b.kind !== "sight" ? 6 : 5,
        color: "#fff", weight: 1.6, fillColor: kd.color, fillOpacity: .92
      }).addTo(map);
      m.bindPopup('<strong>' + escapeHtml(b.name) + "</strong>" +
        (b.city ? "<br>" + escapeHtml(b.city) : "") +
        '<br><span class="tmap__kind" style="color:' + kd.color + '">' + kd.label + "</span>" +
        '<br><button type="button" class="tmap__goto" data-name="' + escapeHtml(b.name) + '">본문에서 보기 ↓</button>');
      // 라벨은 항상 표시 (마우스 올리지 않아도 보임)
      m.bindTooltip(b.name, {
        permanent: true, direction: "right", offset: [7, 0],
        className: "tmap__lbl tmap__lbl--" + (b.kind || "sight")
      });
      m.on("click", function () { focusPlaceInBody(b.name); });
      pts.push([b.lat, b.lon]);
    });
    cities.forEach(function (c) {
      var m = L.circleMarker([c.lat, c.lon], {
        radius: 9, color: "#fff", weight: 3, fillColor: col, fillOpacity: 1
      }).addTo(map);
      m.bindPopup("<strong>" + escapeHtml(c.name) + "</strong>" + (c.note ? "<br>" + escapeHtml(c.note) : ""));
      m.bindTooltip(c.name, { permanent: true, direction: "right", className: "tmap__ttl", offset: [10, 0] });
      m.on("click", function () { focusPlaceInBody(c.name); });
      pts.push([c.lat, c.lon]);
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" class="tmap__cityjump" data-lat="' + c.lat + '" data-lon="' + c.lon + '">' +
        '<span class="tmap__swatch" style="background:' + col + '"></span>' +
        "<strong>" + escapeHtml(c.name) + "</strong>" + (c.note ? " · " + escapeHtml(c.note) : "") + "</button>";
      container.querySelector(".tmap__cities").appendChild(li);
    });

    if (pts.length === 1) {
      map.setView(pts[0], blds.length ? 14 : 12);   // 한 곳뿐이면 적당히 확대
    } else {
      map.fitBounds(L.latLngBounds(pts).pad(0.12));
    }
    container.__map = map;   // 디버깅/확장용 참조

    // 라벨 밀도 — 너무 멀리서 보면 이름이 겹치므로 단계적으로 표시
    // (라벨 자체는 HTML이라 확대해도 글자 크기는 그대로 유지됩니다)
    var pane = map.getPane("tooltipPane");
    function labelDensity() {
      var z = map.getZoom();
      var many = blds.length > 30;
      pane.classList.toggle("lbl-hide-bldg", many && z < 12);   // 도시 이름만
      pane.classList.toggle("lbl-tiny", z < 14);                 // 작게
    }
    map.on("zoomend", labelDensity);
    labelDensity();

    // 범례 — 어떤 종류가 실제로 있는지만 표시
    var legendKeys = Object.keys(KIND).filter(function (k) { return used[k]; });
    if (legendKeys.length > 1) {
      var lg = el("ul", { class: "tmap__kinds" },
        legendKeys.map(function (k) {
          return '<li><span class="tmap__swatch" style="background:' + KIND[k].color + '"></span>' +
            KIND[k].label + "</li>";
        }).join(""));
      container.insertBefore(lg, container.querySelector(".tmap__hint"));
    }

    container.querySelector(".tmap__cities").addEventListener("click", function (e) {
      var b = e.target.closest(".tmap__cityjump"); if (!b) return;
      map.flyTo([parseFloat(b.dataset.lat), parseFloat(b.dataset.lon)], 14, { duration: .8 });
    });
    // 팝업 안의 "본문에서 보기" 버튼
    container.addEventListener("click", function (e) {
      var g = e.target.closest(".tmap__goto"); if (!g) return;
      focusPlaceInBody(g.getAttribute("data-name"));
    });
    setTimeout(function () { map.invalidateSize(); }, 60);
    return true;
  }

  function renderDetailMap(container, cfg, color) {
    if (!container || !cfg) return;
    if (renderRealMap(container, cfg, color)) return;   // 실제 지도 우선
    if (!cfg.svg) { container.remove(); return; }
    fetch(cfg.svg).then(function (r) {
      if (!r.ok) throw new Error("no map");
      return r.text();
    }).then(function (svgText) {
      container.innerHTML = '<div class="tmap__detail-wrap">' + svgText + "</div>" +
        '<ul class="tmap__cities"></ul>';
      var svg = container.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("class", "tmap__detail-svg");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      var pins = svg.querySelector("#pins") || svg;
      var b = cfg.bounds;                       // {lonMin,lonMax,latMax,latMin,w,h}
      function px(lon) { return (lon - b.lonMin) * (b.w / (b.lonMax - b.lonMin)); }
      function py(lat) { return (b.latMax - lat) * (b.h / (b.latMax - b.latMin)); }
      var NS = "http://www.w3.org/2000/svg";
      var list = container.querySelector(".tmap__cities");
      var col = color || "#8c5cc8";

      // --- building-level pins (small dots, no label until zoomed) ---
      (cfg.buildings || []).forEach(function (bd) {
        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "tmap__bldgpin");
        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", px(bd.lon)); dot.setAttribute("cy", py(bd.lat));
        dot.setAttribute("r", 5);
        dot.setAttribute("fill", col); dot.setAttribute("fill-opacity", ".85");
        dot.setAttribute("stroke", "#fff"); dot.setAttribute("stroke-width", "1.6");
        var lb = document.createElementNS(NS, "text");
        lb.setAttribute("x", px(bd.lon)); lb.setAttribute("y", py(bd.lat));
        lb.setAttribute("class", "tmap__bldglabel");
        lb.textContent = bd.name;
        var t = document.createElementNS(NS, "title");
        t.textContent = bd.name + (bd.city ? " · " + bd.city : "");
        g.appendChild(dot); g.appendChild(lb); g.appendChild(t);
        pins.appendChild(g);
      });

      // --- city pins (bigger, always labelled) ---
      (cfg.cities || []).forEach(function (c) {
        var cx = px(c.lon), cy = py(c.lat);
        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "tmap__citypin");

        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("r", 13);
        dot.setAttribute("fill", col);
        dot.setAttribute("stroke", "#fff"); dot.setAttribute("stroke-width", "4");

        var label = document.createElementNS(NS, "text");
        label.setAttribute("x", cx); label.setAttribute("y", cy);
        label.setAttribute("class", "tmap__citylabel");
        label.textContent = c.name;

        var t = document.createElementNS(NS, "title");
        t.textContent = c.name + (c.note ? " — " + c.note : "");
        g.appendChild(dot); g.appendChild(label); g.appendChild(t);
        pins.appendChild(g);

        var li = document.createElement("li");
        li.innerHTML = '<span class="tmap__swatch" style="background:' + col + '"></span>' +
          "<strong>" + escapeHtml(c.name) + "</strong>" + (c.note ? " · " + escapeHtml(c.note) : "");
        list.appendChild(li);
      });

      // zoom / pan on the detail map too
      var wrap = container.querySelector(".tmap__detail-wrap");
      enableMapZoom(svg, wrap, b.w, b.h, { maxZoom: 40 });
      if ((cfg.buildings || []).length) {
        var hint = document.createElement("p");
        hint.className = "tmap__hint";
        hint.textContent = "확대하면 방문한 건물 단위 위치가 보입니다. (휠·드래그·＋／－)";
        container.insertBefore(hint, list);
      }
    }).catch(function () { container.remove(); });
  }

  /* -----------------------------------------------------------
     8. Blog: category filter + expand/collapse
     ----------------------------------------------------------- */
  function blog() {
    var chips = document.querySelectorAll(".cat-filter .chip");
    var posts = document.querySelectorAll(".post");
    if (chips.length) {
      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          chips.forEach(function (c) { c.classList.remove("active"); c.setAttribute("aria-pressed", "false"); });
          chip.classList.add("active");
          chip.setAttribute("aria-pressed", "true");
          var cat = chip.getAttribute("data-cat");
          posts.forEach(function (p) {
            var cats = (p.getAttribute("data-cats") || "").split(",");
            var show = cat === "all" || cats.indexOf(cat) !== -1;
            p.style.display = show ? "" : "none";
          });
        });
      });
    }
    document.querySelectorAll(".post__toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var full = btn.parentElement.querySelector(".post__full");
        if (!full) return;
        var open = full.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.querySelector(".label").textContent = open ? "접기" : "더 읽기";
      });
    });
  }

  /* -----------------------------------------------------------
     9. Gallery lightbox
     ----------------------------------------------------------- */
  function lightbox() {
    var figs = Array.prototype.slice.call(document.querySelectorAll(".masonry figure img"));
    if (!figs.length) return;
    var box = el("div", { class: "lightbox", role: "dialog", "aria-modal": "true", "aria-label": "Image viewer" });
    box.innerHTML =
      '<button class="lightbox__close" aria-label="Close">×</button>' +
      '<button class="lightbox__nav prev" aria-label="Previous">‹</button>' +
      '<img alt="">' +
      '<button class="lightbox__nav next" aria-label="Next">›</button>';
    document.body.appendChild(box);
    var img = box.querySelector("img");
    var closeBtn = box.querySelector(".lightbox__close");
    var prevBtn = box.querySelector(".prev");
    var nextBtn = box.querySelector(".next");
    var idx = 0, opener = null;

    function show(n) {
      idx = (n + figs.length) % figs.length;
      img.src = figs[idx].src;
      img.alt = figs[idx].alt || "";
    }
    function open(n) {
      opener = document.activeElement;          // remember trigger
      show(n);
      box.classList.add("open");
      document.body.style.overflow = "hidden";
      closeBtn.focus();                         // move focus into dialog
    }
    function close() {
      box.classList.remove("open");
      document.body.style.overflow = "";
      if (opener && opener.focus) opener.focus(); // restore focus
    }

    // Make each real image openable by mouse AND keyboard.
    figs.forEach(function (im, n) {
      var fig = im.parentElement;
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "이미지 크게 보기" + (im.alt ? " — " + im.alt : ""));
      fig.addEventListener("click", function () { open(n); });
      fig.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(n); }
      });
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function (e) { e.stopPropagation(); show(idx - 1); });
    nextBtn.addEventListener("click", function (e) { e.stopPropagation(); show(idx + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") { close(); }
      else if (e.key === "ArrowLeft") { show(idx - 1); }
      else if (e.key === "ArrowRight") { show(idx + 1); }
      else if (e.key === "Tab") {                // trap focus within the dialog
        var f = [closeBtn, prevBtn, nextBtn];
        var pos = f.indexOf(document.activeElement);
        e.preventDefault();
        var to = e.shiftKey ? (pos <= 0 ? f.length - 1 : pos - 1)
                            : (pos >= f.length - 1 ? 0 : pos + 1);
        f[to].focus();
      }
    });
  }

  /* -----------------------------------------------------------
     10. Contact form → opens the visitor's mail app (mailto).
         No server required for static hosting.
     ----------------------------------------------------------- */
  function contactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name    = (form.elements.name    || {}).value || "";
      var email   = (form.elements.email   || {}).value || "";
      var subject = (form.elements.subject || {}).value || "Message from your website";
      var message = (form.elements.message || {}).value || "";
      var body =
        message + "\n\n—\n" +
        "From: " + name + "\n" +
        "Email: " + email;
      var href = "mailto:" + SITE.email +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      window.location.href = href;

      var note = form.querySelector(".form__note");
      if (note) note.textContent = "메일 앱이 열립니다. 열리지 않으면 " + SITE.email + " 로 직접 보내주세요.";
    });
  }

  /* -----------------------------------------------------------
     11. Publications (나의 연구) — render 논문 / 연구보고서 from
         window.RESEARCH (assets/data/research.js), newest first.
     ----------------------------------------------------------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fallbackLink(it, kind) {
    if (kind === "report") {
      return "https://www.google.com/search?q=" + encodeURIComponent(it.title + " 경기연구원");
    }
    return "https://scholar.google.com/scholar?q=" + encodeURIComponent(it.title);
  }
  function publications() {
    var mount = document.getElementById("publications");
    if (!mount || !window.RESEARCH) return;
    var R = window.RESEARCH;
    var cats = [
      { key: "papers",  label: "Journals", kind: "paper", grouped: true },
      { key: "reports", label: "Reports",  kind: "report", grouped: true,
        groupField: "role", order: ["책임", "공동", "위탁"],
        groupLabels: { "책임": "연구책임", "공동": "공동연구", "위탁": "위탁연구" } },
      { key: "issues",  label: "이슈 대응", kind: "issue", grouped: false,
        emptyMsg: "기고·이슈 대응 글을 이곳에 모을 예정입니다. (준비 중)" },
      { key: "theses",  label: "학위논문", kind: "paper", grouped: true }
    ];
    var tierOrder = ["박사학위논문", "석사학위논문", "학사 졸업작품", "SCIE", "SCOPUS", "KCI", "기고", "기타"];
    function byDateDesc(a, b) { return (b.sort || 0) - (a.sort || 0); }

    function itemHtml(it, kind, hideRole) {
      var link = it.link || (window.RESEARCH_LINKS || {})[it.title] || fallbackLink(it, kind);
      var role = (!hideRole && it.role)
        ? '<span class="pub__role' + (/(1저자|주저자|책임)/.test(it.role) ? " is-lead" : "") + '">' + escapeHtml(it.role) + "</span>"
        : "";
      // 온라인에 원문이 없는 항목(설계 작품 등)은 링크 없이 제목만 보여 준다
      var title = it.nolink
        ? '<span class="pub__title">' + escapeHtml(it.title) + "</span>"
        : '<a class="pub__title" href="' + link + '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(it.title) + '<span class="pub__ext" aria-hidden="true">↗</span></a>';
      return '<li class="pub">' +
          '<span class="pub__date">' + escapeHtml(it.date) + "</span>" +
          '<span class="pub__body">' + title +
            (it.venue ? '<span class="pub__meta">' + escapeHtml(it.venue) + "</span>" : "") +
          "</span>" + role +
        "</li>";
    }
    function listHtml(items, kind, hideRole) {
      return '<ol class="pub-list">' + items.map(function (it) { return itemHtml(it, kind, hideRole); }).join("") + "</ol>";
    }
    function panelBody(cat) {
      var items = (R[cat.key] || []).slice().sort(byDateDesc);
      if (!items.length) {
        return '<p class="placeholder-note" lang="ko">' + escapeHtml(cat.emptyMsg || "준비 중입니다.") + "</p>";
      }
      if (!cat.grouped) return listHtml(items, cat.kind);
      var field = cat.groupField || "tier";
      var order = cat.order || tierOrder;
      var labels = cat.groupLabels || null;
      var hideRole = false;   // show the role badge (연구책임/공동/위탁) on every row too
      var groups = {};
      items.forEach(function (it) { var g = it[field] || "기타"; (groups[g] = groups[g] || []).push(it); });
      var keys = Object.keys(groups).sort(function (a, b) {
        var ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      return keys.map(function (g) {
        var header = (labels && labels[g]) ? labels[g] : g;
        return '<div class="pub-subgroup">' +
          '<h3 class="pub-subgroup__title">' + escapeHtml(header) + " <span>" + groups[g].length + "</span></h3>" +
          listHtml(groups[g], cat.kind, hideRole) + "</div>";
      }).join("");
    }

    /* 주소에 ?tab=... 이 붙어 오면 그 갈래를 펴 놓습니다 (상단 차림표에서 옵니다) */
    var want = new URLSearchParams(location.search).get("tab");
    var start = 0;
    cats.forEach(function (c, i) { if (c.key === want) start = i; });

    var tabs = '<div class="pub-tabs" role="tablist" aria-label="연구 분류">';
    var panels = '<div class="pub-panels">';
    cats.forEach(function (cat, i) {
      var count = (R[cat.key] || []).length;
      var on = i === start;
      tabs += '<button class="pub-tab' + (on ? " active" : "") + '" role="tab" aria-selected="' +
        (on ? "true" : "false") + '" data-cat="' + cat.key + '">' +
        escapeHtml(cat.label) + ' <span class="pub-tab__n">' + count + "</span></button>";
      panels += '<div class="pub-panel' + (on ? " active" : "") + '" role="tabpanel" data-cat="' + cat.key + '"' +
        (on ? "" : " hidden") + ">" + panelBody(cat) + "</div>";
    });
    mount.innerHTML = tabs + "</div>" + panels + "</div>";

    var tabEls = [].slice.call(mount.querySelectorAll(".pub-tab"));
    var panelEls = [].slice.call(mount.querySelectorAll(".pub-panel"));
    tabEls.forEach(function (t) {
      t.addEventListener("click", function () {
        var cat = t.getAttribute("data-cat");
        tabEls.forEach(function (x) {
          var on = x === t;
          x.classList.toggle("active", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        panelEls.forEach(function (p) {
          var on = p.getAttribute("data-cat") === cat;
          p.classList.toggle("active", on);
          if (on) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
        });
      });
    });
  }

  /* -----------------------------------------------------------
     Map archive 검색 — pictures.html 의 카드 목록을 이름으로 거릅니다.
     ----------------------------------------------------------- */
  function mapArchive() {
    var box = document.getElementById("archive-search");
    var grid = document.getElementById("mapcards");
    if (!box || !grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".mapcard"));
    var count = document.getElementById("archive-count");
    var empty = document.getElementById("archive-empty");
    if (count) count.textContent = cards.length;

    box.addEventListener("input", function () {
      var q = box.value.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var hay = ((c.dataset.title || "") + " " + c.textContent).toLowerCase();
        var hit = !q || hay.indexOf(q) !== -1;
        c.hidden = !hit;
        if (hit) shown++;
      });
      if (count) count.textContent = shown;
      if (empty) empty.hidden = shown !== 0;
    });
  }

  /* -----------------------------------------------------------
     Init
     ----------------------------------------------------------- */
  function init() {
    buildHeader();
    buildFooter();
    buildToTop();
    heroRotator();
    blogPosts();   // inject posts before blog() wires up filter/toggle
    blog();
    travelBoard();
    travelPostPage();
    travelMap();
    lightbox();
    contactForm();
    publications();   // inject before scrollReveal so its .reveal blocks are observed
    mapArchive();
    scrollReveal();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
