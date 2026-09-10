// ─── 한글 문서(hwpx) 읽기 ───────────────────────────────────
//
//  hwpx 는 zip 안에 XML 이 든 꼴입니다 (docx 와 같은 얼개).
//
//    회의록.hwpx
//      Contents/content.hpf     ← 차례(어느 section 이 먼저인지) 와 그림 목록
//      Contents/section0.xml    ← 글. <hp:p> 가 문단, <hp:t> 가 글자
//      BinData/image1.bmp       ← 붙여 넣은 사진 (hc:img binaryItemIDRef="image1")
//
//  브라우저 안에서 zip 을 풀어 **글**과 **사진**을 꺼냅니다.
//  바깥 라이브러리 없이 갑니다 — zip 의 압축(deflate)은 브라우저가
//  DecompressionStream 으로 풀어 줍니다.
//
//  옛 한글(.hwp, 이진 꼴)은 읽지 못합니다 — 파일만 붙입니다.
//
//  글·그림 차례를 뜯는 셈(textFromSection · imageRefs · manifest · unzip)은
//  화면이 없어 node 나 브라우저 시험 페이지에서 곧바로 시험할 수 있습니다.

/* ── zip ─────────────────────────────────────────────────── */

const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;

/** deflate 로 눌린 조각을 폅니다 — 브라우저의 DecompressionStream 으로 */
export async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function")
    throw new Error("이 브라우저는 zip 을 풀지 못합니다 (DecompressionStream 없음)");
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/** 이름 → 파일 정보. zip64 는 안 봅니다 (hwpx 는 그렇게 크지 않습니다). */
export function zipEntries(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const dec = new TextDecoder("utf-8");
  /* 끝 기록(EOCD)을 뒤에서부터 찾습니다 — 꼬리말이 붙어 있을 수 있어 */
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip 이 아닙니다");
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== SIG_CEN) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true);
    const el = dv.getUint16(p + 30, true);
    const cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    out.set(name, { name, method, csize, usize, off });
    p += 46 + nl + el + cl;
  }
  return out;
}

/** zip 하나를 열어 「이름으로 꺼내기」 를 돌려줍니다.
 *  @param bytes  ArrayBuffer 나 Uint8Array
 *  @param inflate  (Uint8Array) → Promise<Uint8Array> — 없으면 브라우저 것
 */
export function unzip(bytes, inflate) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const entries = zipEntries(u8);
  const puff = inflate || inflateRaw;
  return {
    names: [...entries.keys()],
    has: (name) => entries.has(name),
    async read(name) {
      const e = entries.get(name);
      if (!e) return null;
      if (dv.getUint32(e.off, true) !== SIG_LOC) throw new Error("zip 이 깨졌습니다: " + name);
      const nl = dv.getUint16(e.off + 26, true), el = dv.getUint16(e.off + 28, true);
      const a = e.off + 30 + nl + el;
      const raw = u8.subarray(a, a + e.csize);
      if (e.method === 0) return raw;
      if (e.method === 8) return puff(raw);
      throw new Error("모르는 압축 방식 " + e.method + ": " + name);
    },
    async text(name) {
      const b = await this.read(name);
      return b == null ? "" : new TextDecoder("utf-8").decode(b);
    },
  };
}

/* ── hwpx XML ─────────────────────────────────────────────── */

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const decodeXml = (s) => String(s || "").replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === "#") {
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return isNaN(n) ? m : String.fromCodePoint(n);
  }
  return ENT[e] != null ? ENT[e] : m;
});

/** section XML 을 문단 차례로 — [{text, images:[id…]}].
 *  <hp:t> 안의 <hp:lineBreak/> 는 줄바꿈, 그 밖의 태그는 뺍니다.
 *  글도 그림도 없는 문단은 빈 글로 남깁니다 (차례를 지키려고). */
export function parasFromSection(xml) {
  const s = String(xml || "");
  const NL = String.fromCharCode(10);
  const out = [];
  const reP = /<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g;
  const reT = /<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g;
  const reI = /<hc:img\b[^>]*\bbinaryItemIDRef="([^"]+)"/g;
  let m;
  while ((m = reP.exec(s))) {
    const inner = m[1];
    let t = "", k;
    reT.lastIndex = 0;
    while ((k = reT.exec(inner))) {
      t += k[1].replace(/<hp:lineBreak\s*\/>/g, NL).replace(/<hp:tab\s*\/>/g, "\t")
                .replace(/<[^>]+>/g, "");
    }
    const images = [];
    reI.lastIndex = 0;
    while ((k = reI.exec(inner))) if (images.indexOf(k[1]) < 0) images.push(k[1]);
    out.push({ text: decodeXml(t).replace(/\s+$/, ""), images });
  }
  return out;
}

/** section XML 에서 글만 — 빈 문단은 하나로 줄입니다. */
export function textFromSection(xml) {
  const NL = String.fromCharCode(10);
  const lines = [];
  let blank = false;
  parasFromSection(xml).forEach((p) => {
    if (!p.text.trim()) { if (lines.length && !blank) { lines.push(""); blank = true; } return; }
    lines.push(p.text); blank = false;
  });
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join(NL);
}

/** 문서에 그림이 놓인 차례대로 그 그림의 id (BinData 열쇠) */
export function imageRefs(xml) {
  const out = [];
  const re = /<hc:img\b[^>]*\bbinaryItemIDRef="([^"]+)"/g;
  let m;
  while ((m = re.exec(String(xml || "")))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
  return out;
}

/** content.hpf 의 목록 — { items: {id: {href, type}}, spine: [id…] } */
export function manifest(hpf) {
  const s = String(hpf || "");
  const items = {};
  const re = /<opf:item\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(s))) {
    const at = (k) => { const x = new RegExp("\\b" + k + '="([^"]*)"').exec(m[1]); return x ? decodeXml(x[1]) : ""; };
    const id = at("id");
    if (id) items[id] = { href: at("href"), type: at("media-type") };
  }
  const spine = [];
  const rs = /<opf:itemref\b[^>]*\bidref="([^"]+)"/g;
  while ((m = rs.exec(s))) spine.push(m[1]);
  return { items, spine };
}

const MIME = { bmp: "image/bmp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
               gif: "image/gif", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff" };
export const mimeOf = (name) => MIME[String(name || "").split(".").pop().toLowerCase()] || "";

/** hwpx 파일 하나를 읽어 글과 사진을 돌려줍니다.
 *  @param file  File (또는 arrayBuffer() 가 있는 것)
 *  @param inflate  시험용 — 없으면 브라우저 것
 *  @returns { text, paras:[{text, images}], images: [{ id, name, bytes, type }] }
 *           사진은 문서에 놓인 차례
 */
export async function readHwpx(file, inflate) {
  const z = unzip(await file.arrayBuffer(), inflate);
  const mf = z.has("Contents/content.hpf") ? manifest(await z.text("Contents/content.hpf"))
                                            : { items: {}, spine: [] };
  /* 차례(spine)에 적힌 section 부터, 없으면 이름순 section*.xml */
  let secs = mf.spine.map((id) => (mf.items[id] || {}).href).filter((h) => /section\d+\.xml$/i.test(h || ""));
  if (!secs.length) secs = z.names.filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));
  const texts = [], ids = [], paras = [];
  for (const h of secs) {
    const xml = await z.text(h.indexOf("Contents/") === 0 ? h : "Contents/" + h.replace(/^\.?\//, ""));
    const t = textFromSection(xml);
    if (t) texts.push(t);
    parasFromSection(xml).forEach((p) => paras.push(p));
    imageRefs(xml).forEach((id) => { if (ids.indexOf(id) < 0) ids.push(id); });
  }
  /* 글에 안 놓였어도 BinData 에 든 그림은 뒤에 붙입니다 */
  Object.keys(mf.items).forEach((id) => {
    const it = mf.items[id];
    if (/^image\//.test(it.type || "") && ids.indexOf(id) < 0) ids.push(id);
  });
  const images = [];
  for (const id of ids) {
    const it = mf.items[id];
    let href = it && it.href;
    if (!href) {
      href = z.names.find((n) => new RegExp("^BinData/" + id + "\\.", "i").test(n)) || "";
    }
    if (!href) continue;
    const bytes = await z.read(href);
    if (!bytes) continue;
    const name = href.split("/").pop();
    images.push({ id, name, bytes, type: (it && it.type) || mimeOf(name) || "application/octet-stream" });
  }
  return { text: texts.join(String.fromCharCode(10) + String.fromCharCode(10)), paras, images };
}

/* ── 사진을 게시판에 맞게 줄이기 ─────────────────────────── */

/** 한글에 붙여 넣은 사진은 BMP(수십 MB)로 들어가 있곤 합니다.
 *  긴 변이 maxSide 를 넘거나 bmp·tiff 이거나 크기가 limit 를 넘으면
 *  JPEG 로 다시 그립니다. 그렇지 않으면 그대로 돌려줍니다.
 *  브라우저 밖(시험)에서는 그대로 돌려줍니다.
 *  @returns { blob, type, changed }
 */
export async function shrinkImage(blob, opt) {
  const o = Object.assign({ maxSide: 2400, quality: 0.86, limit: 4 * 1024 * 1024 }, opt || {});
  const type = String(blob.type || "");
  const heavy = /bmp|tiff/.test(type) || blob.size > o.limit;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { blob, type, changed: false };
  }
  let bmp;
  try { bmp = await createImageBitmap(blob); }
  catch (e) { return { blob, type, changed: false }; }
  const big = Math.max(bmp.width, bmp.height);
  if (!heavy && big <= o.maxSide) { bmp.close && bmp.close(); return { blob, type, changed: false }; }
  const k = big > o.maxSide ? o.maxSide / big : 1;
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  const out = await new Promise((res) => cv.toBlob(res, "image/jpeg", o.quality));
  if (!out) return { blob, type, changed: false };
  return { blob: out, type: "image/jpeg", changed: true };
}
