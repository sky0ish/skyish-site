// ─── 구글 열쇠 간수하기 시험 ────────────────────────────────
//
//   돌리는 법 :  node tools/test/gcal-token.mjs
//
// 「구글 연결 단추가 사라졌다」 와 「한 시간마다 끊긴다」 를
// 되풀이하지 않기 위한 시험입니다. 마당마다 왜 그것을 재는지 적어 둡니다.

/* ── 브라우저 시늉 ── */
const store = new Map();
let blocked = false;                 // 저장소가 막힌 브라우저 흉내
globalThis.localStorage = {
  getItem: (k) => { if (blocked) throw new Error("막힘"); return store.has(k) ? store.get(k) : null; },
  setItem: (k, v) => { if (blocked) throw new Error("막힘"); store.set(k, String(v)); },
  removeItem: (k) => { if (blocked) throw new Error("막힘"); store.delete(k); },
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null,
};

globalThis.window = globalThis;      // gcal.js 가 window.google 을 봅니다

let asked = 0;                       // 구글에 새 열쇠를 몇 번 물었나
let give = null;                     // 물으면 무엇을 줄까
let lastCfg = null;                  // 구글에 넘긴 설정 (prompt 를 봅니다)
let hang = false;                    // callback 을 영영 안 주는 흉내
const GOOGLE = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg) => {
        lastCfg = cfg;
        return {
          requestAccessToken: () => {
            asked++;
            if (hang) return;
            setTimeout(() => cfg.callback(
              give ? { access_token: give, expires_in: 3600 } : {}), 0);
          },
        };
      },
    },
  },
};
globalThis.google = GOOGLE;

/* 구글 조각 내려받기가 실패하는 흉내 — script 의 onerror 를 곧바로 부릅니다 */
globalThis.document = {
  createElement: () => ({ set onerror(f) { setTimeout(f, 0); }, set onload(f) {} }),
  head: { appendChild() {} },
};

const KEY = "skyish-gcal-token";
const put = (tok, minsLeft) => {
  store.set(KEY, JSON.stringify({ token: tok, exp: Date.now() + minsLeft * 60 * 1000 }));
  store.set(KEY + "-ok", "1");
};

const GC = await import("../../assets/js/gcal.js");

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

console.log("\n── ① 끊으면 정말 끊깁니다 ──");
// 열쇠는 localStorage 에 두는데 전에는 sessionStorage 를 지웠습니다.
put("살아있는열쇠", 60);
eq("이어져 있다", GC.connected(), true);
GC.disconnect();
eq("끊은 뒤에는 이어져 있지 않다", GC.connected(), false);
eq("저장소에서도 지워졌다", store.has(KEY), false);
eq("다시 이을 수 있게 기억은 남는다", GC.everLinked(), true);

console.log("\n── ② 손수 끊으면 기억까지 지웁니다 ──");
put("열쇠", 60);
GC.disconnect(true);
eq("이어져 있지 않다", GC.connected(), false);
eq("기억도 지워졌다", GC.everLinked(), false);

console.log("\n── ③ 스스로 만료되면 끊긴 것으로 봅니다 ──");
// 아무도 disconnect() 를 부르지 않고 시간만 지나는 길입니다.
// 전에는 모듈 안에 남은 죽은 열쇠 때문에 connected() 가 계속 참이었고,
// 그래서 「다시 잇기」 단추가 그 탭에서 영영 나타나지 않았습니다.
GC.disconnect(true);
put("멀쩡한열쇠", 30);
asked = 0; give = null;
await GC.silent();                                   // 모듈 안에 열쇠가 앉습니다
eq("아직은 이어져 있다", GC.connected(), true);
store.set(KEY, JSON.stringify({ token: "멀쩡한열쇠", exp: Date.now() - 1000 }));
eq("만료되면 끊긴 것으로 본다", GC.connected(), false);

console.log("\n── ④ 만료가 다가오면 미리 새로 받습니다 ──");
GC.disconnect(true);
put("곧죽을열쇠", 2);            // 두 분 남음 — 여유(5분)보다 짧습니다
asked = 0; give = "새열쇠"; lastCfg = null;
eq("새 열쇠를 받았다", await GC.silent(), "새열쇠");
eq("구글에 한 번 물었다", asked, 1);
eq("창을 띄우지 않는 방식으로 물었다", lastCfg && lastCfg.prompt, "none");
eq("받은 열쇠를 저장했다", JSON.parse(store.get(KEY)).token, "새열쇠");
eq("이어진 것으로 본다", GC.connected(), true);

console.log("\n── ⑤ 넉넉히 남았으면 그냥 씁니다 ──");
GC.disconnect(true);
put("멀쩡한열쇠", 30);           // 서른 분 남음
asked = 0; give = "쓸데없는새열쇠";
eq("있던 열쇠를 그대로 쓴다", await GC.silent(), "멀쩡한열쇠");
eq("구글에 묻지 않았다", asked, 0);

console.log("\n── ⑥ 이은 적이 없으면 조용히 잇지 않습니다 ──");
store.clear();
asked = 0; give = "아무거나";
eq("아무것도 안 준다", await GC.silent(), null);
eq("구글에 묻지 않았다", asked, 0);

console.log("\n── ⑦ 겹쳐 불러도 구글에는 한 번만 묻습니다 ──");
// month() 가 calendars() 를 부르는 식으로 한꺼번에 두 번 물으면
// 창이 두 번 뜨거나 4초를 두 번 기다립니다.
GC.disconnect(true);
put("곧죽을열쇠", 2);
asked = 0; give = "한번받은열쇠";
const [a, b, c] = await Promise.all([GC.silent(), GC.silent(), GC.silent()]);
eq("셋 다 같은 열쇠를 받았다", [a, b, c], ["한번받은열쇠", "한번받은열쇠", "한번받은열쇠"]);
eq("구글에는 한 번만 물었다", asked, 1);

console.log("\n── ⑧ 구글 조각을 못 받아도 터지지 않습니다 ──");
// 전에는 loadGis() 의 예외가 그대로 올라가 통째로 실패했습니다.
GC.disconnect(true);
store.set(KEY + "-ok", "1");
globalThis.google = undefined;                       // 조각이 없습니다 → 내려받기 시도 → 실패
let threw = null;
const got = await GC.silent().catch((e) => { threw = e; return "던짐"; });
eq("예외를 던지지 않는다", threw, null);
eq("조용히 null 을 준다", got, null);
globalThis.google = GOOGLE;

console.log("\n── ⑨ 저장소가 막힌 브라우저에서도 터지지 않습니다 ──");
blocked = true;
eq("이어져 있지 않다고 본다", GC.connected(), false);
eq("기억도 없다고 본다", GC.everLinked(), false);
let threw2 = null;
try { GC.disconnect(true); } catch (e) { threw2 = e; }
eq("끊기가 터지지 않는다", threw2, null);
blocked = false;

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
