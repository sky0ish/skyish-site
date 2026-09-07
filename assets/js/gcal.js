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
import { GCAL_CLIENT_ID } from "../../auth/config.js";

/* calendar.events — 일정을 읽고 「쓸 수도」 있는 권한입니다.
   전에는 readonly 였는데, 게시판에서 쓴 일정을 구글로도 넣으려면 이게 필요합니다.
   권한을 넓혔으니 이미 이어 두셨던 분은 한 번 다시 이어 주셔야 합니다. */
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
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
  keepAlive();
};

/** 권한 받기 — 처음 한 번은 구글 창이 뜹니다 */
export async function connect(force) {
  if (!GCAL_CLIENT_ID) throw new Error("먼저 auth/config.js 에 GCAL_CLIENT_ID 를 적어주세요.");
  if (!force) {
    const t = saved();
    if (t) { token = t; return t; }
  }
  await loadGis();
  return new Promise((ok, no) => {
    let done = false;
    let clock = 0;
    const win = (t) => { if (!done) { done = true; try { clearTimeout(clock); } catch (e) {} ok(t); } };
    const lose = (e) => { if (!done) { done = true; try { clearTimeout(clock); } catch (e2) {} no(e); } };
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
  if (forget) lastFail = 0;
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

/** 내가 쓰는 캘린더 목록 (숨긴 것은 뺍니다) */
export async function calendars(tok) {
  const t = tok || await useToken();
  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: "Bearer " + t } });
  if (r.status === 401 || r.status === 403) {
    if (await authFail(r)) {
      disconnect();
      throw new Error("권한이 풀렸습니다. 다시 연결해 주세요.");
    }
    throw new Error("구글이 잠시 바쁩니다 — 조금 뒤에 다시 해 주세요.");
  }
  if (!r.ok) throw new Error("캘린더 목록을 받지 못했습니다 (HTTP " + r.status + ")");
  const j = await r.json();
  return (j.items || [])
    .filter((c) => c.selected !== false && !c.deleted)
    .map((c) => ({
      id: c.id,
      name: c.summaryOverride || c.summary || c.id,
      color: c.backgroundColor || "#4285f4",
    }));
}

/**
 * 한 달치 일정을 받아 옵니다 — 쓰고 계신 캘린더를 모두 훑습니다.
 * @returns [{date:"2026-08-14", title, place, time, cal, color}]
 */
export async function month(year, mon0) {
  const t = await useToken();
  const from = new Date(year, mon0, 1);
  const to = new Date(year, mon0 + 1, 1);
  const cals = await calendars(t);

  const one = async (c) => {
    const u = "https://www.googleapis.com/calendar/v3/calendars/"
      + encodeURIComponent(c.id) + "/events"
      + "?singleEvents=true&orderBy=startTime&maxResults=250"
      + "&timeMin=" + encodeURIComponent(from.toISOString())
      + "&timeMax=" + encodeURIComponent(to.toISOString());
    try {
      const r = await fetch(u, { headers: { Authorization: "Bearer " + t } });
      if (!r.ok) return [];
      const j = await r.json();
      return (j.items || []).map((e) => {
        const s = e.start || {};
        const day = s.date || (s.dateTime || "").slice(0, 10);
        return {
          date: day,
          // 구글이 매긴 번호 — 내 글과 짝지어 겹침을 걷을 때 씁니다
          gid: e.id || "",
          title: e.summary || "(제목 없음)",
          place: e.location || "",
          allDay: !!s.date,
          time: s.dateTime ? s.dateTime.slice(11, 16) : "",
          cal: c.name,
          calId: c.id,          // 지울 때 씁니다 (이름이 아니라 번호로 부릅니다)
          color: c.color,
        };
      }).filter((x) => x.date);
    } catch (err) { return []; }
  };

  const lists = await Promise.all(cals.map(one));
  const all = [].concat.apply([], lists);
  // 같은 일정이 여러 캘린더에 겹쳐 있으면 한 번만
  const seen = new Set();
  return all.filter((e) => {
    const k = e.date + "|" + e.title + "|" + e.time;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
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
