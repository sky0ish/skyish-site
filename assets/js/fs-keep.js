// ─── 고른 폴더를 기억해 둡니다 ──────────────────────────────
//
//  「이거 저번에 세팅했는데 왜 자꾸 여러번해야하는거야?
//    한번 세팅하면 계속 유지되게 해줄수없을까?」
//
//  「🎙 회의록 붙이기」·「📂 워크샵 올리기」 를 누를 때마다 폴더를 다시 찾아
//  고르는 일이 없게, 한 번 고른 폴더 손잡이를 이 브라우저(IndexedDB)에 담아 둡니다.
//  다음부터는 그 손잡이를 그대로 씁니다.
//    · 허락이 살아 있으면  → 곧바로
//    · 허락이 잠들었으면    → 「이 폴더를 계속 쓸까요?」 한 번만 (폴더를 다시 찾지 않습니다)
//    · 손잡이가 없거나 폴더를 옮기셨으면 → 그때만 폴더 고르기
//  Shift 를 누른 채 단추를 누르면 폴더를 바꿀 수 있습니다.
//
//  손잡이는 이 브라우저 안에만 있습니다 — 어디로도 올라가지 않습니다.

const DB = "skyish-folders", STORE = "handle";

const openDb = () => new Promise((ok, no) => {
  if (typeof indexedDB === "undefined") return no(new Error("이 브라우저는 폴더를 기억하지 못합니다"));
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
  };
  r.onsuccess = () => { const d = r.result; d.onversionchange = () => { try { d.close(); } catch (e) {} }; ok(d); };
  r.onerror = () => no(r.error);
  r.onblocked = () => no(new Error("다른 창이 자료방을 붙잡고 있습니다"));
  if (typeof setTimeout === "function") setTimeout(() => no(new Error("자료방이 답하지 않습니다")), 3000);
});

const tx = (db, mode) => db.transaction(STORE, mode).objectStore(STORE);
const wrap = (req) => new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });

/** 고른 폴더를 담아 둡니다 */
export async function remember(key, handle) {
  if (!key || !handle) return false;
  try { const db = await openDb(); await wrap(tx(db, "readwrite").put(handle, key)); db.close(); return true; }
  catch (e) { return false; }
}

/** 담아 둔 폴더 손잡이 — 없으면 null */
export async function recall(key) {
  try { const db = await openDb(); const h = await wrap(tx(db, "readonly").get(key)); db.close(); return h || null; }
  catch (e) { return null; }
}

/** 잊습니다 (폴더를 옮기셨거나 바꾸실 때) */
export async function forget(key) {
  try { const db = await openDb(); await wrap(tx(db, "readwrite").delete(key)); db.close(); return true; }
  catch (e) { return false; }
}

/** 이 손잡이를 지금 쓸 수 있는가 —
 *  "granted"(그대로 쓸 수 있음) · "prompt"(한 번 여쭈면 됨) · "denied"(안 됨) · "none"(손잡이 없음)
 *  @param h      폴더 손잡이
 *  @param mode   "read" | "readwrite"
 *  @param ask    true 면 잠든 허락을 깨웁니다(단추를 누른 그 자리에서만 됩니다)
 */
export async function usable(h, mode, ask) {
  if (!h || typeof h.queryPermission !== "function") return "none";
  let st;
  try { st = await h.queryPermission({ mode: mode || "read" }); } catch (e) { st = "prompt"; }
  if (st === "granted") return "granted";
  if (!ask || typeof h.requestPermission !== "function") return st === "denied" ? "denied" : "prompt";
  try { st = await h.requestPermission({ mode: mode || "read" }); } catch (e) { st = "denied"; }
  return st === "granted" ? "granted" : "denied";
}

/** 쓸 폴더를 내어 줍니다 — 기억해 둔 것이 있으면 그것을, 없으면 고르게 합니다.
 *  @param key    기억할 이름 ("rec" · "ws")
 *  @param opt    {mode, id, again, picker, say}
 *                mode   "read" | "readwrite"
 *                id     폴더 고르기 창이 기억할 자리 (showDirectoryPicker 의 id)
 *                again  true 면 기억은 접어 두고 새로 고릅니다 (Shift 를 누른 채 눌렀을 때)
 *                picker 시험용 — 없으면 window.showDirectoryPicker
 *                say    알림 글 (선택)
 *  @returns {handle, from:"kept"|"picked"|null}  — 고르다 닫으시면 handle null
 */
export async function pick(key, opt) {
  const o = opt || {};
  const mode = o.mode || "read";
  const picker = o.picker || (typeof window !== "undefined" && window.showDirectoryPicker
    ? (a) => window.showDirectoryPicker(a) : null);
  const say = typeof o.say === "function" ? o.say : () => {};

  if (!o.again) {
    const kept = await recall(key);
    if (kept) {
      const st = await usable(kept, mode, true);
      if (st === "granted") { say("기억해 둔 폴더를 그대로 씁니다 — " + (kept.name || "")); return { handle: kept, from: "kept" }; }
      /* 허락을 안 주셨으면 폴더를 다시 고르게 합니다 (기억은 지웁니다) */
      await forget(key);
    }
  }
  if (!picker) return { handle: null, from: null };
  let h = null;
  try { h = await picker({ id: o.id || key, mode: mode }); }
  catch (e) { return { handle: null, from: null }; }          // 고르다 닫으신 것
  if (h) await remember(key, h);
  return { handle: h, from: "picked" };
}

/** 기억해 둔 폴더 이름 — 안내 글에 씁니다 ("" 면 아직 없습니다) */
export async function keptName(key) {
  const h = await recall(key);
  return h && h.name ? h.name : "";
}
