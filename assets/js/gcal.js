// ─── 구글 캘린더 불러오기 ──────────────────────────────────
// 끼워넣기(iframe)는 비공개 캘린더의 내용을 보여 주지 않습니다.
// 그래서 구글에 '읽기만' 권한을 받아 일정을 직접 받아 옵니다.
//
// 준비 (한 번만)
//   1. https://console.cloud.google.com 에서 프로젝트를 하나 만듭니다
//   2. API 및 서비스 → 라이브러리 → "Google Calendar API" 사용 설정
//   3. OAuth 동의 화면 → 외부 → 앱 이름·이메일만 적고 저장
//      테스트 사용자에 whlove@gmail.com 을 넣습니다
//   4. 사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션
//      승인된 자바스크립트 원본에  https://skyish.kr  를 넣습니다
//   5. 나온 클라이언트 ID 를 auth/config.js 의 GCAL_CLIENT_ID 에 적습니다
//
// ── 「한 번 이으면 내가 끊기 전까지」 ──────────────────────
//  구글이 주는 열쇠(access token)는 한 시간짜리입니다. 서버가 없으니
//  갱신 열쇠(refresh token)는 받을 수 없습니다. 그래서 이렇게 합니다.
//
//    · 한 번 이어 두었다는 표시(-ok)는 **사람이 손수 끊기 전까지** 남습니다.
//    · 열쇠가 만료될 즈음이면 시계를 걸어 두었다가 창 없이 조용히 새로 받습니다.
//      화면을 덮어 두었다 다시 켤 때도 그렇게 합니다.
//    · 화면은 「열쇠가 지금 살아 있나」(connected) 가 아니라
//      「이어져 있나」(linked) 로 판단합니다. 그래야 한 시간마다
//      「연결이 풀렸습니다」 가 뜨지 않습니다.
//    · 「다시 잇기」 단추는 조용히 잇기가 **정말 실패했을 때만** 나옵니다.
import { GCAL_CLIENT_ID, SUPABASE_URL, SUPABASE_KEY } from "../../auth/config.js";

/* ── 「구글에 로그인돼 있으면 늘 연결」 — 서버가 간직한 갱신 열쇠 ──────
   브라우저만으로는 1시간짜리 열쇠밖에 못 받고, 창 없이 새로 받는 길(prompt:none)은
   「사람이 누르지 않은 팝업」 이라 브라우저가 자주 막습니다. 그래서 연결이 자꾸 풀렸습니다.
   이제 처음 한 번 이을 때 구글이 주는 **갱신 열쇠**를 Supabase 서버 함수(gcal-token)가
   간직하고, 열쇠가 필요할 때마다 서버에 조용히 받아 옵니다 — 창이 뜨지 않습니다.
   skyish.kr 에 관리자로 로그인돼 있으면 폰·PC 어디서나 이어져 있습니다.
   서버 함수가 아직 없거나 로그인 전이면 예전 방식 그대로 갑니다. */
const FN = (SUPABASE_URL || "") + "/functions/v1/gcal-token";
let srv = null;            // null 모름 · "on" 서버 쓸 수 있음 · "off" 서버 없음/로그인 안 함
let srvLinked = null;      // 서버에 갱신 열쇠가 있나 (null 모름)

async function session() {
  try {
    const m = await import("../../auth/auth.js");
    const { data } = await m.sb.auth.getSession();
    return (data && data.session && data.session.access_token) || "";
  } catch (e) { return ""; }
}

/** 서버 함수를 부릅니다 — 쓸 수 없으면 null */
async function server(action, extra) {
  if (srv === "off" || !SUPABASE_URL || typeof fetch !== "function") return null;
  const jwt = await session();
  if (!jwt) { srv = "off"; return null; }
  let r;
  try {
    r = await fetch(FN, {
      method: "POST",
      headers: { Authorization: "Bearer " + jwt, apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action }, extra || {})),
    });
  } catch (e) { return null; }                 // 잠깐 끊김 — 서버가 없다고 단정하지 않습니다
  let j = {};
  try { j = await r.json(); } catch (e) {}
  /* 함수가 아직 올라가 있지 않으면 Supabase 가 404 NOT_FOUND 를 줍니다 (우리 404 는 relink 를 답니다) */
  if ((r.status === 404 && !j.relink) || r.status === 403 ||
      (r.status === 500 && /GOOGLE_CLIENT/.test(j.error || ""))) { srv = "off"; return null; }   // 아직 준비 전
  srv = "on";
  return Object.assign({ ok: r.ok, status: r.status }, j);
}

/** 서버에서 새 1시간 열쇠 — 창 없음 */
async function serverRefresh() {
  const x = await server("refresh");
  if (!x) return null;
  if (x.ok && x.access_token) {
    srvLinked = true;
    token = x.access_token;
    keep(token, x.expires_in || 3600);
    return token;
  }
  if (x.relink) srvLinked = false;
  return null;
}

/** 화면이 열릴 때 서버를 쓸 수 있는지 미리 알아 둡니다.
    잇기 단추를 누른 「뒤」 에 물으면 그 사이 「사람이 눌렀다」 는 효력이 끝나
    브라우저가 구글 창을 막습니다. */
let probing = null;
function probe() {
  if (srv !== null || probing) return probing;
  probing = serverRefresh().catch(() => null).finally(() => { probing = null; });
  return probing;
}
export const serverMode = () => srv === "on";
/** 서버에 갱신 열쇠가 있나 — true 있음 · false 없음 · null 아직 모름 */
export const serverLinked = () => srvLinked;
/** 서버를 쓸 수 있는지·열쇠가 있는지 알아봅니다 (살아 있는 열쇠가 있어도) */
export const probeServer = () => probe() || Promise.resolve(null);

/* calendar.events — 일정을 읽고 「쓸 수도」 있는 권한입니다.
   전에는 readonly 였는데, 게시판에서 쓴 일정을 구글로도 넣으려면 이게 필요합니다.
   권한을 넓혔으니 이미 이어 두셨던 분은 한 번 다시 이어 주셔야 합니다. */
/* 일정 쓰기(calendar.events) + **캘린더 목록 읽기**(calendar.readonly).
   calendar.events 만으로는 users/me/calendarList 를 읽을 수 없습니다 —
   구글이 403(insufficientPermissions)을 돌려주고, 그것을 「권한이 풀렸다」 로
   보아 열쇠를 버리는 바람에 ① 구글 일정이 통째로 안 보이고 ② 연결이 자꾸
   풀리는 것처럼 보였습니다. 범위가 늘었으니 처음 한 번만 다시 허락을 받습니다. */
const SCOPE = "https://www.googleapis.com/auth/calendar.events " +
              "https://www.googleapis.com/auth/calendar.readonly";
const KEY = "skyish-gcal-token";
const OKKEY = KEY + "-ok";
/* 만료 다섯 분 전부터는 미리 새로 받아 둡니다 */
const FRESH = 5 * 60 * 1000;
/* 조용히 잇기를 기다려 주는 시간.
   전에는 4초였는데, 폰에서 구글 조각(50KB)을 처음 받아 오는 길은 그보다
   자주 깁니다. 4초에 포기하면 뒤늦게 도착한 열쇠는 저장만 되고 버려졌고,
   화면에는 이미 「연결이 풀렸습니다」 가 그려진 뒤였습니다. */
const WAIT = 15000;
/* 조용히 잇기가 실패하면 이만큼은 다시 묻지 않습니다 —
   화면을 옮길 때마다 15초를 되풀이해 태우지 않게. */
const COOL = 30 * 1000;

let token = null;
let lastFail = 0;          // 조용히 잇기가 마지막으로 실패한 시각
let timer = 0;             // 미리 새로 받아 두는 시계
let watching = false;      // 화면을 다시 켤 때 살피기 시작했는가

/* 열쇠는 localStorage 에 둡니다.
   전에는 sessionStorage 라 탭을 닫으면 사라져, 열 때마다 다시 이어야 했습니다.
   이 브라우저 안에만 있고 어디로도 나가지 않습니다. */
function rawSaved() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
}
function saved(marginMs) {
  const v = rawSaved();
  if (v && v.exp > Date.now() + (marginMs || 0)) return v.token;
  return null;
}
function keep(t, sec) {
  /* 하한을 둡니다 — expires_in 이 60 보다 작게 오면 (- 60) 이 음수가 되어
     「이미 만료된 열쇠」 를 저장했습니다. 이었다고 알린 그 순간
     다시 「풀렸습니다」 가 뜨던 까닭입니다. */
  const life = Math.max(30, (Number(sec) || 3600) - 60);
  try {
    localStorage.setItem(KEY, JSON.stringify({ token: t, exp: Date.now() + life * 1000 }));
    // 한 번 이어 두었음을 기억합니다 — 사람이 손수 끊기 전까지 남습니다
    localStorage.setItem(OKKEY, "1");
  } catch (e) {}
  lastFail = 0;               // 받아 왔으니 실패 기억을 지웁니다
  schedule();                 // 다음 갱신을 미리 걸어 둡니다
}

/** 전에 이어 둔 적이 있는가 (열쇠가 만료됐어도) */
export const everLinked = () => {
  try { return localStorage.getItem(OKKEY) === "1"; } catch (e) { return false; }
};

/** 화면에 「이어져 있다」 고 보여 줄 것인가.
 *  열쇠는 한 시간마다 만료되지만 그것은 연결이 풀린 것이 아닙니다 —
 *  전에는 이 둘을 같은 것으로 보아, 한 시간마다 「연결이 풀렸습니다」 가
 *  떴습니다. 조용히 잇기가 정말 실패했을 때만 풀린 것으로 봅니다. */
export const linked = () => !!saved() || (everLinked() && !lastFail);

/* 조용히 잇기가 이미 돌고 있으면 그 하나를 함께 씁니다.
   month() 가 calendars() 를 부르는 식으로 한 번에 두 번 물으면,
   창이 두 번 뜨거나 오래 기다리는 일이 두 번 생깁니다. */
let silentJob = null;

/** 창을 띄우지 않고 조용히 열쇠만 다시 받아 옵니다.
    구글에 이미 로그인돼 있고 전에 허락하셨다면 됩니다.
    어떤 일이 있어도 예외를 던지지 않고 null 을 돌려줍니다. */
export async function silent() {
  const t = saved(FRESH);
  if (t) { token = t; return t; }
  /* ① 서버가 간직한 갱신 열쇠로 — 창이 뜨지 않고, 이 기기에서 처음이어도 됩니다 */
  if (srv !== "off") {
    const s = await serverRefresh().catch(() => null);
    if (s) return s;
    if (srv === "on") { lastFail = Date.now(); return null; }   // 서버는 있는데 아직 안 이음
  }
  if (!GCAL_CLIENT_ID || !everLinked()) return null;
  if (silentJob) return silentJob;                 // 돌고 있으면 그것을 기다립니다
  if (lastFail && Date.now() - lastFail < COOL) return null;   // 방금 실패했으면 쉽니다
  silentJob = (async () => {
    /* 구글 조각을 못 받아도 여기서 끝냅니다 —
       전에는 예외가 useToken() 까지 올라가, 아직 살아 있는 열쇠를 두고도
       통째로 실패했습니다. */
    try { await loadGis(); } catch (e) { lastFail = Date.now(); return null; }
    return new Promise((ok) => {
      let done = false;
      let clock = 0;
      const fin = (v) => {
        if (done) return;
        done = true;
        if (clock) { try { clearTimeout(clock); } catch (e) {} }
        if (!v) lastFail = Date.now();
        ok(v);
      };
      try {
        const cli = google.accounts.oauth2.initTokenClient({
          client_id: GCAL_CLIENT_ID,
          scope: SCOPE,
          /* "none" 이라야 정말 창을 띄우지 않습니다.
             "" 는 「필요하면 띄운다」 라서, 사람이 누르지 않은 자리에서
             창이 뜨거나 브라우저에 막힙니다. */
          prompt: "none",
          callback: (r) => {
            if (r && r.access_token) {
              token = r.access_token;
              keep(token, r.expires_in || 3600);   // 늦게 와도 열쇠는 간수합니다
              fin(token);
            } else fin(null);
          },
          error_callback: () => fin(null),
        });
        cli.requestAccessToken();
        clock = setTimeout(() => fin(null), WAIT);   // 너무 오래 걸리면 넘어갑니다
      } catch (e) { fin(null); }
    });
  })().finally(() => { silentJob = null; });
  return silentJob;
}

/* ── 만료를 미리 막습니다 ────────────────────────────────
   전에는 누군가 부를 때(화면 열기·달력 켜기)만 갱신했습니다. 그래서 앱을
   켜 둔 채 한 시간이 지나면 열쇠는 죽어 있고, 다음에 만지는 순간에야
   조용히 잇기가 돌았습니다 — 그 사이가 「자꾸 풀린다」 로 느껴집니다. */
function schedule() {
  if (typeof setTimeout !== "function") return;
  try { clearTimeout(timer); } catch (e) {}
  const v = rawSaved();
  if (!v || !v.exp) return;
  const ms = v.exp - Date.now() - FRESH;
  // 24.8일이 넘는 값은 setTimeout 이 못 담습니다 (곧바로 터집니다)
  timer = setTimeout(() => { silent().catch(() => {}); },
                     Math.max(1000, Math.min(ms, 2147483000)));
  // node 로 시험할 때 이 시계 하나 때문에 프로그램이 안 끝나지 않게
  if (timer && typeof timer.unref === "function") timer.unref();
}

/** 미리 받아 두기를 시작합니다 — 화면이 열릴 때 한 번 부르면 됩니다.
    화면을 덮어 두었다 다시 켤 때도 낡았으면 조용히 새로 받습니다.
    (폰에서는 화면이 잠긴 동안 시계가 멈추므로 이쪽이 더 중요합니다.) */
export function keepAlive() {
  if (!GCAL_CLIENT_ID || !everLinked()) return;
  schedule();
  if (watching || typeof document === "undefined" || !document.addEventListener) return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (saved(FRESH)) { schedule(); return; }
    silent().catch(() => {});
  });
}

/** 구글 로그인 조각을 한 번만 불러옵니다 */
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = ok;
    s.onerror = () => no(new Error("구글 로그인 조각을 불러오지 못했습니다"));
    document.head.appendChild(s);
  });
}

export const ready = () => !!GCAL_CLIENT_ID;

/* 구글 프로그램(GIS)을 미리 내려받아 둡니다.
   단추를 누른 「뒤」 에 내려받기 시작하면, 받는 동안
   「사람이 눌렀다」 는 효력이 만료돼 브라우저가 창을 막습니다
   (Failed to open popup window 의 진짜 원인). 화면이 열릴 때 미리 데워 두면
   누른 순간 바로 창이 뜹니다. */
export const warm = () => {
  if (!GCAL_CLIENT_ID) return;
  loadGis().catch(() => {});
  probe();
  keepAlive();
};

/** 권한 받기 — 처음 한 번은 구글 창이 뜹니다 */
export async function connect(force, opt) {
  if (!GCAL_CLIENT_ID) throw new Error("먼저 auth/config.js 에 GCAL_CLIENT_ID 를 적어주세요.");
  /* opt.server — 「늘 연결 켜기」: 지금 열쇠가 살아 있어도 서버에 갱신 열쇠를 맡기러 갑니다 */
  if (!force && !(opt && opt.server)) {
    const t = saved();
    if (t) { token = t; return t; }
  }
  await loadGis();
  return new Promise((ok, no) => {
    let done = false;
    let clock = 0;
    const win = (t) => { if (!done) { done = true; try { clearTimeout(clock); } catch (e) {} ok(t); } };
    const lose = (e) => { if (!done) { done = true; try { clearTimeout(clock); } catch (e2) {} no(e); } };
    /* 서버를 쓸 수 있으면 「코드」 를 받아 서버가 갱신 열쇠로 바꿔 간직합니다 —
       이것 한 번이면 그 뒤로는 창 없이 이어집니다. */
    if (srv === "on" && google.accounts.oauth2.initCodeClient) {
      const cc = google.accounts.oauth2.initCodeClient({
        client_id: GCAL_CLIENT_ID,
        scope: SCOPE,
        ux_mode: "popup",
        select_account: !!force,
        callback: async (r) => {
          if (!r || !r.code) { lose(new Error("권한을 받지 못했습니다")); return; }
          const x = await server("exchange", { code: r.code });
          if (x && x.ok && x.access_token) {
            srvLinked = !!x.kept || srvLinked;
            token = x.access_token;
            keep(token, x.expires_in || 3600);
            win(token);
            /* 구글이 갱신 열쇠를 주지 않았으면(전에 이미 허락한 계정) 한 번 더 받아야 합니다 */
            if (!x.kept && !srvLinked) {
              try { console.warn("구글이 갱신 열쇠를 주지 않았습니다 — 「다시 잇기」 를 한 번 더 눌러 주세요"); } catch (e) {}
            }
          } else lose(new Error((x && x.error) || "서버에 열쇠를 맡기지 못했습니다"));
        },
        error_callback: (e) => lose(new Error((e && e.message) || "구글 창이 닫혔습니다")),
      });
      cc.requestCode();
      if (typeof setTimeout === "function") {
        clock = setTimeout(() => lose(new Error("구글이 답하지 않았습니다 — 다시 눌러 주세요")), 180000);
      }
      return;
    }
    const cli = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID,
      scope: SCOPE,
      /* 계정을 바꾸려면 select_account 가 있어야 합니다.
         consent 만으로는 같은 계정에 동의만 다시 받습니다. */
      prompt: force ? "select_account consent" : "",
      callback: (r) => {
        if (r && r.access_token) {
          token = r.access_token;
          keep(token, r.expires_in || 3600);
          win(token);
        } else lose(new Error("권한을 받지 못했습니다"));
      },
      error_callback: (e) => lose(new Error((e && e.message) || "구글 창이 닫혔습니다")),
    });
    cli.requestAccessToken();
    /* 구글 창이 아무 말 없이 사라지면 callback 도 error_callback 도 오지 않습니다.
       그러면 부른 쪽 단추가 「구글에 묻는 중…」 에서 영영 멈춥니다. */
    if (typeof setTimeout === "function") {
      clock = setTimeout(() => lose(new Error("구글이 답하지 않았습니다 — 다시 눌러 주세요")), 180000);
    }
  });
}

/** 연결 끊기.
 *  @param forget 참이면 「이어 둔 적 있음」 표시까지 지웁니다 —
 *                사람이 손수 끊을 때만. 이 표시가 남아 있는 동안은
 *                열쇠가 만료돼도 창 없이 조용히 다시 잇습니다. */
export function disconnect(forget) {
  token = null;
  /* 열쇠는 localStorage 에 둡니다 — 여기를 지워야 정말 끊깁니다.
     전에는 sessionStorage 를 지워, 죽은 열쇠가 남아 connected() 가 계속
     참이라 「다시 잇기」 단추가 안 나타났습니다. */
  try {
    localStorage.removeItem(KEY);
    if (forget) localStorage.removeItem(OKKEY);
  } catch (e) {}
  if (forget) {
    lastFail = 0;
    /* 손수 끊을 때만 서버의 갱신 열쇠도 구글에 돌려주고 지웁니다 */
    if (srv === "on") { srvLinked = false; server("forget").catch(() => {}); }
  }
  try { clearTimeout(timer); } catch (e) {}
}

/* 저장된 열쇠만 봅니다.
   전에는 (token || saved()) 였는데, 모듈 변수 token 은 disconnect() 에서만
   비워집니다. 열쇠가 스스로 만료되면 saved() 는 null 이 되지만 죽은 token 이
   남아 계속 「이어져 있다」 고 답했고, 그래서 「다시 잇기」 단추가 그 탭에서
   영영 나타나지 않았습니다 — 바로 그 증상입니다.

   ※ 이것은 「지금 부를 수 있나」 입니다. 화면에 무엇을 보여 줄지는
      linked() 로 물으십시오. */
export const connected = () => !!saved();

/* 늘 살아 있는 열쇠를 돌려줍니다 — 만료가 다가오면 창 없이 미리 새로 받습니다.
   창은 절대로 스스로 열지 않습니다. 전에는 마지막에 connect() 를 불렀는데,
   그것이 사람이 누르지 않은 자리(화면 열기·달 넘기기)에서 돌면 브라우저가
   팝업을 막아 「Failed to open popup window」 가 떴습니다. */
async function useToken() {
  const ok = saved(FRESH);
  if (ok) { token = ok; return ok; }
  const s = await silent();
  if (s) return s;
  const last = saved();          // 만료가 코앞이어도 아직 살아 있으면 그것으로
  if (last) { token = last; return last; }
  throw new Error("구글 연결이 풀렸습니다 — 「구글 달력 잇기」 를 눌러 주세요.");
}

/* 구글이 돌려준 403 이 정말 권한 문제인가.
   속도 제한·할당량 초과도 403 으로 옵니다. 그것까지 「권한이 풀렸다」 로 보고
   열쇠를 버리면, 잠깐 붐볐을 뿐인데 연결이 끊겨 다시 이으라는 말이 뜹니다. */
const SOFT_403 = [
  "rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded",
  "backendError", "internalError", "variableTermLimitExceeded",
];
async function authFail(r) {
  if (r.status === 401) return true;
  if (r.status !== 403) return false;
  try {
    const j = await r.clone().json();
    const why = (((j || {}).error || {}).errors || []).map((e) => (e && e.reason) || "");
    if (why.some((x) => SOFT_403.indexOf(x) >= 0)) return false;
  } catch (e) {}
  return true;
}

/* ── 마지막 쪽까지 이어 받기 ────────────────────────────
   구글은 목록을 잘라서 줍니다 (nextPageToken). 전에는 첫 쪽만 받고 끝내,
   일정이 많은 달이나 캘린더가 여럿인 계정에서 뒷부분이 통째로 빠졌습니다. */

/* 한꺼번에 몇 개 캘린더까지 물을지.
   전에는 Promise.all 로 모두 한 번에 쏟았습니다. 캘린더가 여남은 개면
   구글이 429·403(rateLimitExceeded)으로 막고, 막힌 캘린더는 아래에서
   조용히 [] 이 되어 「그 캘린더 일정이 통째로 안 보이는」 증상이 됐습니다. */
const LANES = 4;
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* 마지막으로 받아 온 결과를 적어 둡니다 — 화면에서 「무엇이 빠졌는지」
   물어볼 수 있게. 조용히 삼키지 않는 것이 여기의 요점입니다. */
let report = { when: 0, cals: [], failed: [], off: 0, events: 0 };
/** 마지막 불러오기 보고서 { when, cals:[{name,count}], failed:[{name,why}], off, events } */
export const lastReport = () => report;

/** 한 번 물어봅니다 — 잠깐 막힌 것(429·5xx·바쁜 403)은 쉬었다 다시 */
async function ask(url, t, tries) {
  const n = tries == null ? 3 : tries;
  let last = "";
  for (let i = 0; i <= n; i++) {
    let r;
    try {
      r = await fetch(url, { headers: { Authorization: "Bearer " + t } });
    } catch (e) {
      last = "연결이 끊겼습니다";
      await nap(400 * Math.pow(2, i));
      continue;
    }
    if (r.ok) return r.json();
    if (r.status === 401 || (r.status === 403 && await authFail(r))) {
      const e = new Error("권한이 풀렸습니다. 다시 연결해 주세요.");
      e.auth = true;
      e.status = r.status;
      throw e;
    }
    if (r.status === 429 || r.status === 403 || r.status >= 500) {
      last = "구글이 잠시 바쁩니다 (HTTP " + r.status + ")";
      await nap(400 * Math.pow(2, i));   // 0.4초 → 0.8 → 1.6 …
      continue;
    }
    throw new Error("HTTP " + r.status);
  }
  throw new Error(last || "여러 번 물어도 답이 없습니다");
}

/** 마지막 쪽까지 이어 받습니다 */
async function askAll(base, t) {
  const out = [];
  let page = "";
  for (let i = 0; i < 25; i++) {           // 안전 고리 — 끝없이 돌지 않게
    const j = await ask(base + (page ? "&pageToken=" + encodeURIComponent(page) : ""), t);
    if (j && j.items) out.push.apply(out, j.items);
    page = (j && j.nextPageToken) || "";
    if (!page) break;
  }
  return out;
}

/** 내가 볼 수 있는 캘린더를 모두 (지운 것만 뺍니다)
 *
 *  전에는 selected !== false 로 걸렀습니다. 구글은 이 칸을 「캘린더 화면에
 *  체크돼 있나」 로 쓰는데, 폰 앱에서만 켜 두었거나 구독만 해 둔 캘린더는
 *  이 칸이 false 로 와서 통째로 빠졌습니다 (공휴일·동호회 같은 것).
 *  달력에 「전부」 보이는 편이 맞으므로 이제 거르지 않고, 대신 꺼 둔 것이
 *  몇 개였는지만 보고서에 적어 둡니다. */
export async function calendars(tok) {
  const t = tok || await useToken();
  let items;
  try {
    items = await askAll(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList" +
      "?minAccessRole=reader&showHidden=true&maxResults=250", t);
  } catch (e) {
    /* 목록을 못 읽어도 「내 캘린더(primary)」 일정은 읽을 수 있습니다 —
       열쇠를 버리지 않고 그것만이라도 보여 줍니다 (목록 권한만 없는 옛 열쇠). */
    if (e && e.auth && e.status === 401) { disconnect(); throw e; }   // 열쇠가 정말 죽음
    if (e && e.auth) {                                                 // 목록 권한만 없음
      report.off = 0;
      return [{ id: "primary", name: "내 캘린더", color: "#4285f4", off: false, only: true }];
    }
    throw new Error("캘린더 목록을 받지 못했습니다 — " + ((e && e.message) || ""));
  }
  const live = items.filter((c) => !c.deleted);
  report.off = live.filter((c) => c.selected === false).length;
  return live.map((c) => ({
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    color: c.backgroundColor || "#4285f4",
    off: c.selected === false,       // 구글 화면에서는 꺼 두신 캘린더
  }));
}

/* ── 여러 날에 걸친 일정 ────────────────────────────────
   구글은 시작과 끝만 줍니다. 전에는 시작날 한 칸에만 찍어서,
   「추석 연휴(24~26)」 나 「Stay at 선셋 호텔(9~11)」 이 첫날에만 뜨고
   나머지 날은 빈 칸이었습니다. 걸친 날짜를 모두 펼칩니다.
   종일 일정의 end.date 는 구글에서 「다음 날」 이므로 하루 뺍니다. */
const shift = (isoDay, n) => {
  const d = new Date(isoDay + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
         "-" + String(d.getDate()).padStart(2, "0");
};

function spread(e, lo, hi) {
  const s = e.start || {}, en = e.end || {};
  const from = s.date || (s.dateTime || "").slice(0, 10);
  if (!from) return [];
  let to = en.date ? shift(en.date, -1) : ((en.dateTime || "").slice(0, 10) || from);
  if (to < from) to = from;
  const days = [];
  for (let d = from; d <= to && days.length < 400; d = shift(d, 1)) {
    if (d >= lo && d <= hi) days.push(d);
  }
  return days.map((d, i) => ({ day: d, first: d === from, nth: i, span: days.length }));
}

/**
 * 어느 날부터 어느 날까지의 일정을 받아 옵니다 — 볼 수 있는 캘린더를 모두 훑습니다.
 * @param lo "2026-08-30"  @param hi "2026-10-10" (둘 다 그날 포함)
 * @returns [{date, title, place, time, cal, color, gid, calId, allDay, span, nth}]
 */
/**
 * 낱말로 구글 일정 찾기 — 볼 수 있는 캘린더를 모두, lo ~ hi 사이에서 (구글의 q= 찾기)
 * @returns [{date, title, place, time, cal, color, gid, calId}]  (캘린더마다 많아야 50건)
 */
export async function search(q, lo, hi) {
  const t = await useToken();
  const cals = await calendars(t);
  const from = new Date(lo + "T00:00:00"), to = new Date(hi + "T23:59:59");
  const out = [];
  for (let i = 0; i < cals.length; i += LANES) {
    const lists = await Promise.all(cals.slice(i, i + LANES).map(async (c) => {
      const u = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(c.id) + "/events" +
        "?singleEvents=true&orderBy=startTime&maxResults=50&q=" + encodeURIComponent(q) +
        "&timeMin=" + encodeURIComponent(from.toISOString()) + "&timeMax=" + encodeURIComponent(to.toISOString());
      try {
        const j = await ask(u, t, 1);
        return (j.items || []).filter((e) => e.status !== "cancelled").map((e) => {
          const s = e.start || {};
          return { date: s.date || (s.dateTime || "").slice(0, 10), title: e.summary || "(제목 없음)",
                   place: e.location || "", time: s.dateTime ? s.dateTime.slice(11, 16) : "",
                   gid: e.id || "", uid: e.iCalUID || e.id || "", calId: c.id, cal: c.name, color: c.color };
        });
      } catch (err) { if (err && err.auth) throw err; return []; }
    }));
    lists.forEach((l) => out.push.apply(out, l));
  }
  const seen = new Set();
  return out.filter((e) => { const k = e.date + "|" + e.uid; if (seen.has(k)) return false; seen.add(k); return true; });
}

export async function range(lo, hi) {
  const t = await useToken();
  const cals = await calendars(t);
  const from = new Date(lo + "T00:00:00");
  const to = new Date(shift(hi, 1) + "T00:00:00");

  const okCals = [], bad = [];

  const one = async (c) => {
    const base = "https://www.googleapis.com/calendar/v3/calendars/"
      + encodeURIComponent(c.id) + "/events"
      + "?singleEvents=true&orderBy=startTime&maxResults=2500"
      + "&timeMin=" + encodeURIComponent(from.toISOString())
      + "&timeMax=" + encodeURIComponent(to.toISOString());
    let items;
    try {
      items = await askAll(base, t);
    } catch (err) {
      /* 권한이 풀린 것은 그 캘린더만의 일이 아닙니다 — 끊고 위로 올립니다 */
      if (err && err.auth) { disconnect(); throw err; }
      /* 전에는 여기서 조용히 [] 를 돌려주었습니다 — 그래서 캘린더 하나가
         통째로 빠져도 화면에는 아무 말이 없었습니다. 이제 적어 둡니다. */
      bad.push({ name: c.name, why: (err && err.message) || "알 수 없는 까닭" });
      return [];
    }
    const out = [];
    items.forEach((e) => {
      if (e.status === "cancelled") return;
      const s = e.start || {};
      spread(e, lo, hi).forEach((p) => {
        out.push({
          date: p.day,
          // 구글이 매긴 번호 — 내 글과 짝지어 겹침을 걷을 때 씁니다
          gid: e.id || "",
          uid: e.iCalUID || e.id || "",
          title: e.summary || "(제목 없음)",
          place: e.location || "",
          allDay: !!s.date,
          // 걸친 날의 둘째 날부터는 시각을 비웁니다 (첫날에만 몇 시인지 보입니다)
          time: (p.first && s.dateTime) ? s.dateTime.slice(11, 16) : "",
          span: p.span,          // 며칠짜리인가
          nth: p.nth,            // 그 가운데 몇째 날인가 (0부터)
          cal: c.name,
          calId: c.id,          // 지울 때 씁니다 (이름이 아니라 번호로 부릅니다)
          color: c.color,
        });
      });
    });
    okCals.push({ name: c.name, count: out.length });
    return out;
  };

  /* 몇 개씩 나눠 묻습니다 — 한꺼번에 쏟으면 구글이 막습니다 */
  const all = [];
  for (let i = 0; i < cals.length; i += LANES) {
    const lists = await Promise.all(cals.slice(i, i + LANES).map(one));
    lists.forEach((l) => all.push.apply(all, l));
  }

  /* 같은 일정이 여러 캘린더에 겹쳐 있으면 한 번만.
     전에는 「날짜+제목+시각」 으로 묶었는데, 그러면 같은 날 같은 이름의
     **다른** 일정(종일 「학원」 두 건 같은)이 한 건으로 합쳐져 사라졌습니다.
     구글이 붙인 같은 번호(iCalUID)일 때만 같은 일정으로 봅니다. */
  const seen = new Set();
  const uniq = all.filter((e) => {
    const k = e.date + "|" + (e.uid || (e.calId + "|" + e.gid));
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  report = {
    when: Date.now(),
    cals: okCals.sort((a, b) => b.count - a.count),
    failed: bad,
    off: report.off,
    events: uniq.length,
  };

  return uniq.sort((a, b) =>
    (a.date + (a.time || "00:00")).localeCompare(b.date + (b.time || "00:00")));
}

/**
 * 한 달치 — 달력에 그리는 6주 판(앞뒤 딸림 날짜까지) 만큼 받아 옵니다.
 * 전에는 그 달 1일~말일만 받아, 판의 앞뒤 회색 칸은 늘 비어 있었습니다.
 * @returns [{date:"2026-08-14", title, place, time, cal, color}]
 */
export async function month(year, mon0) {
  const first = new Date(year, mon0, 1);
  const lo = new Date(first); lo.setDate(1 - first.getDay());       // 판의 첫 칸
  const hi = new Date(lo); hi.setDate(lo.getDate() + 41);           // 판의 마지막 칸
  const d2s = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
                     "-" + String(d.getDate()).padStart(2, "0");
  return range(d2s(lo), d2s(hi));
}


/** 구글 캘린더에서 일정 하나를 지웁니다.
 *  되돌릴 수 없습니다 — 부르는 쪽에서 반드시 사람에게 물은 뒤에 부르십시오.
 *  @param id    구글이 매긴 일정 번호 (month() 가 주는 gid)
 *  @param calId 어느 캘린더의 것인지 (없으면 내 캘린더)
 */
export async function deleteEvent(id, calId) {
  if (!id) throw new Error("어느 일정인지 알 수 없습니다.");
  const t = await useToken();
  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(calId || "primary") + "/events/" + encodeURIComponent(id),
    { method: "DELETE", headers: { Authorization: "Bearer " + t } });
  /* 410 은 「이미 지워졌다」 입니다 — 바라던 결과이므로 성공으로 봅니다 */
  if (r.ok || r.status === 410 || r.status === 204) return true;
  if (r.status === 401 || r.status === 403) {
    if (await authFail(r)) {
      disconnect();
      throw new Error("구글이 지우기를 막았습니다 — 「구글 달력 잇기」 를 다시 눌러 주세요.");
    }
    throw new Error("구글이 잠시 바쁩니다 — 조금 뒤에 다시 해 주세요.");
  }
  if (r.status === 404) throw new Error("그 일정을 찾지 못했습니다 (이미 지워졌을 수 있습니다).");
  throw new Error("구글에서 지우지 못했습니다 (" + r.status + ")");
}

/* ── 일정 하나를 구글 「내 캘린더(primary)」 에 넣습니다 ──
   @param {date:"2026-09-02", time:"14:00"|"" , title, place}
   시각이 있으면 그때부터 한 시간, 없으면 종일로 넣습니다. */
/** 일정 몸통 — addEvent · updateEvent 가 같이 씁니다 */
function eventBody(ev) {
  const body = { summary: String(ev.title || "").slice(0, 200) };
  if (ev.place) body.location = String(ev.place).slice(0, 200);
  if (ev.time) {
    const beg = ev.date + "T" + ev.time + ":00";
    const d = new Date(beg);
    const end = new Date(d.getTime() + 60 * 60 * 1000);
    const p = (n) => String(n).padStart(2, "0");
    const local = (x) => x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()) +
                         "T" + p(x.getHours()) + ":" + p(x.getMinutes()) + ":00";
    body.start = { dateTime: beg, timeZone: "Asia/Seoul" };
    body.end   = { dateTime: local(end), timeZone: "Asia/Seoul" };
  } else {
    const d = new Date(ev.date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const next = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
                 "-" + String(d.getDate()).padStart(2, "0");
    body.start = { date: ev.date };
    body.end   = { date: next };
  }
  return body;
}

/** 이미 있는 구글 일정을 고칩니다 — 시각·장소·제목을 행사 정보대로 바로잡을 때.
 *  @param id     구글 일정 번호 (글의 gcal_id)
 *  @param ev     { date, time, title, place }  — time 이 비면 종일
 *  @param calId  어느 캘린더인지 (없으면 내 캘린더)
 *  @returns true — 없는 일정(404)이면 false, 그 밖의 실패는 던집니다 */
export async function updateEvent(id, ev, calId) {
  const t = await useToken();
  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calId || "primary") +
      "/events/" + encodeURIComponent(id),
    { method: "PATCH",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(ev)) });
  if (r.status === 404 || r.status === 410) return false;
  if (!r.ok) {
    if (r.status === 403 || r.status === 401) {
      if (await authFail(r)) { disconnect(); throw new Error("구글이 쓰기를 막았습니다 — 「구글 달력 잇기」 를 다시 눌러 주세요."); }
      throw new Error("구글이 잠시 바쁩니다 — 조금 뒤에 다시 해 주세요.");
    }
    throw new Error("구글 일정을 고치지 못했습니다 (" + r.status + ")");
  }
  return true;
}

export async function addEvent(ev) {
  const t = await useToken();
  const body = { summary: String(ev.title || "").slice(0, 200) };
  if (ev.place) body.location = String(ev.place).slice(0, 200);
  if (ev.time) {
    const beg = ev.date + "T" + ev.time + ":00";
    /* 끝은 「한 시간 뒤」 — 날짜까지 함께 넘깁니다.
       전에는 시(hour)만 Math.min(23, h+1) 로 잘라, 23시 일정은 끝이 23시가 되어
       길이 0 짜리 일정이 구글에 들어갔습니다. */
    const d = new Date(beg);
    const end = new Date(d.getTime() + 60 * 60 * 1000);
    const p = (n) => String(n).padStart(2, "0");
    const local = (x) => x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()) +
                         "T" + p(x.getHours()) + ":" + p(x.getMinutes()) + ":00";
    body.start = { dateTime: beg, timeZone: "Asia/Seoul" };
    body.end   = { dateTime: local(end), timeZone: "Asia/Seoul" };
  } else {
    // 종일 일정 — 구글은 끝을 「다음 날」 로 받습니다
    const d = new Date(ev.date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const next = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
                 "-" + String(d.getDate()).padStart(2, "0");
    body.start = { date: ev.date };
    body.end   = { date: next };
  }
  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    { method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(body) });
  if (!r.ok) {
    if (r.status === 403 || r.status === 401) {
      if (await authFail(r)) {
        disconnect();
        throw new Error("구글이 쓰기를 막았습니다 — 「구글 달력 잇기」 를 다시 눌러 새 권한으로 이어 주세요.");
      }
      throw new Error("구글이 잠시 바쁩니다 — 조금 뒤에 다시 해 주세요.");
    }
    throw new Error("구글에 넣지 못했습니다 (" + r.status + ")");
  }
  return (await r.json()).id || "";
}
