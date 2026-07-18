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
    nav: [
      { label: "HOME",     file: "index.html"    },
      { label: "ABOUT",    file: "about.html"    },
      { label: "WORKS",    file: "works.html"    },
      { label: "GALLERY",  file: "pictures.html" },
      { label: "BLOG",     file: "blog.html"     },
      { label: "CONTACT",  file: "contact.html"  }
    ],
    email: "whlove@gmail.com",
    phone: "***REMOVED***",
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
    SITE.nav.forEach(function (item) {
      var a = el("a", { href: item.file }, item.label);
      if (item.file === here) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
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
      if (e.target.tagName === "A") {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
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
            '<a href="tel:' + SITE.phone.replace(/[^0-9+]/g, "") + '">' + SITE.phone + "</a>" +
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
     Init
     ----------------------------------------------------------- */
  function init() {
    buildHeader();
    buildFooter();
    buildToTop();
    heroRotator();
    scrollReveal();
    blog();
    lightbox();
    contactForm();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
