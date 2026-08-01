/* =============================================================
   블로그 글쓰기 (blog-write.html)
   -------------------------------------------------------------
   - 쓰는 도중 내용은 이 브라우저에 자동 저장됩니다 (localStorage)
   - 사진은 assets/img/blog/ 에 넣을 파일로 내려받습니다
   - 내보내기를 누르면 posts.js 에 붙여넣을 코드가 만들어집니다
   ============================================================= */
(function () {
  "use strict";
  var KEY = "blog-draft";
  var $ = function (id) { return document.getElementById(id); };
  var body = $("bw-body");
  if (!body) return;

  var photos = [];   // {name, dataUrl, file}

  /* ---------- 서식 도구 ---------- */
  function surround(tag) {
    var sel = selectionInEditor();
    if (!sel || !sel.toString().trim()) { alert("굵게/기울임은 글자를 먼저 선택한 뒤 눌러 주세요."); return; }
    var r = sel.getRangeAt(0);
    var el = document.createElement(tag);
    try { r.surroundContents(el); }
    catch (e) { el.appendChild(r.extractContents()); r.insertNode(el); }
    sel.removeAllRanges();
  }
  /* 편집기 안에 커서가 있고 실제로 선택된 글이 있을 때만 그 자리에 넣는다.
     그렇지 않으면 맨 끝에 새 블록으로 붙인다 — 문단 안에 목록이 끼는 것을 막는다. */
  function selectionInEditor() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var n = sel.getRangeAt(0).commonAncestorContainer;
    n = n.nodeType === 1 ? n : n.parentNode;
    return body.contains(n) ? sel : null;
  }
  function placeBlock(el, sel) {
    if (sel && sel.toString().trim()) {
      var r = sel.getRangeAt(0);
      // 문단 안이면 그 문단 뒤로 빼서 넣는다
      var blk = r.commonAncestorContainer;
      blk = blk.nodeType === 1 ? blk : blk.parentNode;
      while (blk && blk !== body && !/^(P|H3|UL|OL|BLOCKQUOTE|FIGURE|DIV)$/.test(blk.tagName)) blk = blk.parentNode;
      r.deleteContents();
      if (blk && blk !== body && blk.parentNode === body) blk.insertAdjacentElement("afterend", el);
      else r.insertNode(el);
    } else {
      body.appendChild(el);
    }
    var after = document.createElement("p");
    after.appendChild(document.createElement("br"));
    el.insertAdjacentElement("afterend", after);
    // 새 블록 끝으로 커서 이동
    var s = window.getSelection(), rr = document.createRange();
    rr.selectNodeContents(el); rr.collapse(false);
    s.removeAllRanges(); s.addRange(rr);
  }
  function wrapBlock(tag) {
    var sel = selectionInEditor();
    var text = sel ? sel.toString().trim() : "";
    var el = document.createElement(tag);
    el.textContent = text || (tag === "h3" ? "소제목" : "인용할 내용");
    placeBlock(el, sel);
  }
  function makeList(tag) {
    var sel = selectionInEditor();
    var text = sel ? sel.toString() : "";
    var lines = text.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) lines = ["항목 1", "항목 2"];
    var list = document.createElement(tag);
    lines.forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t;
      list.appendChild(li);
    });
    placeBlock(list, sel);
  }

  document.querySelector(".bw__tools").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    body.focus();
    var c = b.getAttribute("data-cmd");
    if (c === "bold") surround("strong");
    else if (c === "italic") surround("em");
    else if (c === "h3") wrapBlock("h3");
    else if (c === "quote") wrapBlock("blockquote");
    else if (c === "ul") makeList("ul");
    else if (c === "ol") makeList("ol");
    else if (c === "link") {
      var url = prompt("링크 주소를 입력하세요", "https://");
      if (!url) return;
      var sel = window.getSelection();
      var a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = (sel && sel.toString()) || url;
      if (sel && sel.rangeCount) { var r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(a); }
      else body.appendChild(a);
    } else if (c === "clear") {
      var s2 = window.getSelection();
      if (s2 && s2.toString()) {
        var t = s2.toString();
        var r2 = s2.getRangeAt(0);
        r2.deleteContents();
        r2.insertNode(document.createTextNode(t));
      }
    }
    save();
  });

  /* ---------- 사진 ---------- */
  /* 웹에서 안전한 파일명으로 — 한글은 살리고 공백·특수문자만 정리.
     이름이 남지 않으면 날짜+번호로 대체한다. */
  function safeName(orig) {
    var m = /^(.*?)(\.[A-Za-z0-9]+)?$/.exec(orig || "");
    var base = (m[1] || "").trim();
    var ext = (m[2] || ".jpg").toLowerCase();
    base = base.replace(/[\\/:*?"<>|#%&{}$!'`+=@]+/g, "")
               .replace(/\s+/g, "-")
               .replace(/-+/g, "-")
               .replace(/^-|-$/g, "");
    if (!base || /^-+$/.test(base)) {
      var d = ($("bw-date").value || "").replace(/-/g, "") || "img";
      base = d + "-" + (photos.length + 1);
    }
    var name = (base + ext).slice(0, 80);
    // 같은 이름이 있으면 번호를 붙인다
    var n = 1, out = name;
    while (photos.some(function (p) { return p.name === out; })) {
      out = base + "-" + (++n) + ext;
    }
    return out;
  }

  function addPhotos(files) {
    [].forEach.call(files, function (f) {
      if (!/^image\//.test(f.type)) return;
      var fr = new FileReader();
      fr.onload = function () {
        photos.push({ name: safeName(f.name), dataUrl: fr.result });
        renderThumbs();
        save();
      };
      fr.readAsDataURL(f);
    });
  }
  function renderThumbs() {
    var ul = $("bw-thumbs");
    ul.innerHTML = photos.map(function (p, i) {
      return '<li><img src="' + p.dataUrl + '" alt="">' +
        '<span>' + p.name + "</span>" +
        '<button type="button" data-ins="' + i + '">본문에 넣기</button>' +
        '<button type="button" data-del="' + i + '" class="bw__x">삭제</button></li>';
    }).join("");
  }
  $("bw-thumbs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-del")) {
      photos.splice(+b.getAttribute("data-del"), 1);
      renderThumbs(); save(); return;
    }
    var p = photos[+b.getAttribute("data-ins")];
    if (!p) return;
    var fig = document.createElement("figure");
    fig.className = "bw__inline";
    fig.innerHTML = '<img src="' + p.dataUrl + '" data-file="' + p.name + '" alt="">' +
      "<figcaption>사진 설명을 쓰세요</figcaption>";
    body.appendChild(fig);
    body.appendChild(document.createElement("p"));
    save();
  });

  $("bw-pick").addEventListener("click", function () { $("bw-file").click(); });
  $("bw-file").addEventListener("change", function (e) { addPhotos(e.target.files); });
  var drop = $("bw-drop");
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
  });
  drop.addEventListener("drop", function (e) { addPhotos(e.dataTransfer.files); });
  body.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addPhotos(e.dataTransfer.files); }
  });

  /* ---------- 자동 저장 ---------- */
  function state() {
    return {
      title: $("bw-title").value, date: $("bw-date").value,
      cat: $("bw-cat").value, excerpt: $("bw-excerpt").value,
      html: body.innerHTML, photos: photos
    };
  }
  var savedTag = $("bw-saved"), tmr;
  function save() {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state()));
        savedTag.textContent = "자동 저장됨";
        setTimeout(function () { savedTag.textContent = ""; }, 1600);
      } catch (e) {
        savedTag.textContent = "사진이 많아 자동 저장에 실패했습니다 — 내보내기를 해 두세요";
      }
    }, 400);
  }
  ["bw-title", "bw-date", "bw-cat", "bw-excerpt"].forEach(function (id) {
    $(id).addEventListener("input", save);
  });
  body.addEventListener("input", save);

  (function restore() {
    var raw = localStorage.getItem(KEY);
    if (!raw) { $("bw-date").valueAsDate = new Date(); return; }
    try {
      var s = JSON.parse(raw);
      $("bw-title").value = s.title || "";
      $("bw-date").value = s.date || "";
      $("bw-cat").value = s.cat || $("bw-cat").value;
      $("bw-excerpt").value = s.excerpt || "";
      body.innerHTML = s.html || "";
      photos = s.photos || [];
      renderThumbs();
    } catch (e) { $("bw-date").valueAsDate = new Date(); }
  })();

  /* ---------- 미리보기 ---------- */
  $("bw-preview").addEventListener("click", function () {
    var p = $("bw-prev");
    var cat = $("bw-cat").value.split("|");
    $("pv-cat").textContent = cat[1] || "";
    $("pv-date").textContent = ($("bw-date").value || "").replace(/-/g, ".");
    $("pv-title").textContent = $("bw-title").value || "(제목 없음)";
    $("pv-excerpt").textContent = $("bw-excerpt").value || "";
    $("pv-body").innerHTML = body.innerHTML;
    p.hidden = false;
    p.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- 내보내기 ---------- */
  function download(name, blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function dataUrlToBlob(u) {
    var parts = u.split(","), mime = /:(.*?);/.exec(parts[0])[1];
    var bin = atob(parts[1]), n = bin.length, arr = new Uint8Array(n);
    while (n--) arr[n] = bin.charCodeAt(n);
    return new Blob([arr], { type: mime });
  }
  function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

  $("bw-export").addEventListener("click", function () {
    var title = $("bw-title").value.trim();
    if (!title) { alert("제목을 입력해 주세요."); $("bw-title").focus(); return; }

    // 본문의 data URL 이미지를 실제 파일 경로로 바꾼다
    var tmp = document.createElement("div");
    tmp.innerHTML = body.innerHTML;
    [].forEach.call(tmp.querySelectorAll("img"), function (im) {
      var f = im.getAttribute("data-file");
      if (f) { im.setAttribute("src", "assets/img/blog/" + f); im.removeAttribute("data-file"); }
      im.setAttribute("loading", "lazy");
    });
    var html = tmp.innerHTML.replace(/\s+$/, "");

    var cat = $("bw-cat").value.split("|");
    var d = ($("bw-date").value || "").replace(/-/g, ".");
    var code =
      "  {\n" +
      '    date: "' + d + '",\n' +
      '    title: "' + esc(title) + '",\n' +
      '    catLabel: "' + esc(cat[1] || "") + '",\n' +
      '    cats: ["' + (cat[0] || "daily") + '"],\n' +
      '    excerpt: "' + esc($("bw-excerpt").value.trim()) + '",\n' +
      '    body: "' + esc(html) + '"\n' +
      "  },";

    $("bw-code").textContent = code;
    $("bw-out").hidden = false;

    download("새글.txt", new Blob([code], { type: "text/plain;charset=utf-8" }));
    photos.forEach(function (p) { download(p.name, dataUrlToBlob(p.dataUrl)); });
    $("bw-out").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("bw-copy").addEventListener("click", function (e) {
    var t = $("bw-code").textContent, b = e.currentTarget;
    function done() { b.textContent = "복사됨 ✓"; setTimeout(function () { b.textContent = "코드 복사"; }, 1600); }
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done);
    else {
      var ta = document.createElement("textarea");
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      ta.remove(); done();
    }
  });

  $("bw-clear").addEventListener("click", function () {
    if (!confirm("작성 중인 글과 사진을 모두 지울까요?")) return;
    localStorage.removeItem(KEY);
    $("bw-title").value = ""; $("bw-excerpt").value = "";
    body.innerHTML = ""; photos = []; renderThumbs();
    $("bw-out").hidden = true; $("bw-prev").hidden = true;
    $("bw-date").valueAsDate = new Date();
  });
})();
