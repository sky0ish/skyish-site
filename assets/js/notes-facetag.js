// ─── 사진에서 얼굴 잘라 이름 달기 ───────────────────────────
//
//  글에 붙인 단체 사진 위에 네모를 두르고 이름을 적으면,
//  그 자리를 잘라 그 사람의 얼굴 사진으로 씁니다.
//  잘린 그림은 주소록(브라우저 안)과 9.FACE 폴더에 들어갑니다.
//
//  ※ 얼굴을 알아보는 일은 하지 않습니다. 어디가 누구인지는 사람이 정합니다.
//     인터넷에서 얼굴을 찾아 오지도 않습니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/facetag.mjs).

/** 0~1 사이로 가둡니다 */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 화면에서 끈 두 점을 「그림 안 비율」 네모로 바꿉니다.
 * 비율로 두는 까닭 — 화면 크기가 달라져도 같은 자리를 가리키게 하려고.
 * @param a,b  {x,y} 화면 자리 (그림 왼위를 0,0 으로 잰 것)
 * @param w,h  화면에 보이는 그림의 크기
 * @returns {x,y,w,h} 0~1 비율. 너무 작으면 null
 */
export function boxFromDrag(a, b, w, h) {
  if (!a || !b || !(w > 0) || !(h > 0)) return null;
  const x1 = clamp01(Math.min(a.x, b.x) / w);
  const y1 = clamp01(Math.min(a.y, b.y) / h);
  const x2 = clamp01(Math.max(a.x, b.x) / w);
  const y2 = clamp01(Math.max(a.y, b.y) / h);
  const box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  // 손이 미끄러진 정도(한 변이 2% 미만)는 네모로 보지 않습니다
  if (box.w < 0.02 || box.h < 0.02) return null;
  return box;
}

/**
 * 비율 네모 → 진짜 그림의 픽셀 자리.
 * 얼굴만 딱 자르면 갑갑하므로 둘레를 조금 넉넉히 둡니다(pad).
 * 그림 밖으로 나가지 않게 가둡니다.
 * @param box   {x,y,w,h} 0~1
 * @param nw,nh 진짜 그림 크기
 * @param pad   둘레 여유 (네모 크기에 대한 비율, 기본 0.18)
 */
export function cropRect(box, nw, nh, pad) {
  if (!box || !(nw > 0) || !(nh > 0)) return null;
  const p = pad == null ? 0.18 : pad;
  let x = (box.x - box.w * p) * nw;
  let y = (box.y - box.h * p) * nh;
  let w = box.w * (1 + p * 2) * nw;
  let h = box.h * (1 + p * 2) * nh;
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > nw) w = nw - x;
  if (y + h > nh) h = nh - y;
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  return { x: Math.round(x), y: Math.round(y), w, h };
}

/** 잘라 낼 크기 — 너무 큰 그림은 줄여 담습니다 (한 변 max 안쪽으로) */
export function fitSize(w, h, max) {
  const M = max || 480;
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const s = Math.min(1, M / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/**
 * 「만난 사람」 칸과 명함첩에서 이름 후보를 모읍니다.
 * 그 자리에 있었던 사람이 먼저 나오게 하려고,
 * 글에 적힌 사람을 앞에 두고 명함첩은 뒤에 둡니다.
 * @param peopleText  글의 「만난 사람」 칸
 * @param splitPeople notes-cards.js 의 splitPeople
 * @param cardNames   명함첩 이름들 (문자열 목록)
 * @param q           지금 치고 있는 글자
 */
export function nameHints(peopleText, splitPeople, cardNames, q) {
  const s = String(q || "").trim().toLowerCase();
  const seen = new Set();
  const out = [];
  const put = (n, here) => {
    const k = String(n || "").trim();
    if (!k || seen.has(k)) return;
    if (s && !k.toLowerCase().includes(s)) return;
    seen.add(k);
    out.push({ name: k, here: !!here });
  };
  (typeof splitPeople === "function" ? splitPeople(peopleText) : []).forEach((n) => put(n, true));
  (Array.isArray(cardNames) ? cardNames : []).forEach((n) => put(n, false));
  return out.slice(0, 20);
}

/** 이미 이름을 단 네모들을 글 본문에 적어 둘 한 줄로 (사람이 읽을 수 있게) */
export function tagLine(tags) {
  const names = (Array.isArray(tags) ? tags : [])
    .map((t) => String((t && t.name) || "").trim()).filter(Boolean);
  return names.length ? "사진 속 사람: " + names.join(", ") : "";
}
