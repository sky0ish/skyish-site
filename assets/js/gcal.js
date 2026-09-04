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
import { GCAL_CLIENT_ID } from "../../auth/config.js";

/* calendar.events — 일정을 읽고 「쓸 수도」 있는 권한입니다.
   전에는 readonly 였는데, 게시판에서 쓴 일정을 구글로도 넣으려면 이게 필요합니다.
   권한을 넓혔으니 이미 이어 두셨던 분은 한 번 다시 이어 주셔야 합니다. */
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const KEY = "skyish-gcal-token";
/* 만료 다섯 분 전부터는 미리 새로 받아 둡니다 */
const FRESH = 5 * 60 * 1000;

let token = null;

/* 열쇠는 localStorage 에 둡니다.
   전에는 sessionStorage 라 탭을 닫으면 사라져, 열 때마다 다시 이어야 했습니다.
   이 브라우저 안에만 있고 어디로도 나가지 않습니다. */
function saved(marginMs) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && v.exp > Date.now() + (marginMs || 0)) return v.token;
  } catch (e) {}
  return null;
}
function keep(t, sec) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      token: t, exp: Date.now() + (sec - 60) * 1000,
    }));
    // 한 번 이어 두었음을 기억합니다 — 열쇠가 만료돼도 조용히 다시 잇습니다
    localStorage.setItem(KEY + "-ok", "1");
  } catch (e) {}
}

/** 전에 이어 둔 적이 있는가 (열쇠가 만료됐어도) */
export const everLinked = () => {
  try { return localStorage.getItem(KEY + "-ok") === "1"; } catch (e) { return false; }
};

/* 조용히 잇기가 이미 돌고 있으면 그 하나를 함께 씁니다.
   month() 가 calendars() 를 부르는 식으로 한 번에 두 번 물으면,
   창이 두 번 뜨거나 4초를 두 번 기다리게 됩니다. */
let silentJob = null;

/** 창을 띄우지 않고 조용히 열쇠만 다시 받아 옵니다.
    구글에 이미 로그인돼 있고 전에 허락하셨다면 됩니다.
    어떤 일이 있어도 예외를 던지지 않고 null 을 돌려줍니다. */
export async function silent() {
  const t = saved(FRESH);
  if (t) { token = t; return t; }
  if (!GCAL_CLIENT_ID || !everLinked()) return null;
  if (silentJob) return silentJob;                 // 돌고 있으면 그것을 기다립니다
  silentJob = (async () => {
    /* 구글 조각을 못 받아도 여기서 끝냅니다 —
       전에는 예외가 useToken() 까지 올라가, 아직 살아 있는 열쇠를 두고도
       통째로 실패했습니다. */
    try { await loadGis(); } catch (e) { return null; }
    return new Promise((ok) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; ok(v); } };
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
              keep(token, r.expires_in || 3600);
              fin(token);
            } else fin(null);
          },
          error_callback: () => fin(null),
        });
        cli.requestAccessToken();
        setTimeout(() => fin(null), 4000);   // 오래 걸리면 포기하고 넘어갑니다
      } catch (e) { fin(null); }
    });
  })().finally(() => { silentJob = null; });
  return silentJob;
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
export const warm = () => { if (GCAL_CLIENT_ID) loadGis().catch(() => {}); };

/** 권한 받기 — 처음 한 번은 구글 창이 뜹니다 */
export async function connect(force) {
  if (!GCAL_CLIENT_ID) throw new Error("먼저 auth/config.js 에 GCAL_CLIENT_ID 를 적어주세요.");
  if (!force) {
    const t = saved();
    if (t) { token = t; return t; }
  }
  await loadGis();
  return new Promise((ok, no) => {
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
          ok(token);
        } else no(new Error("권한을 받지 못했습니다"));
      },
      error_callback: (e) => no(new Error((e && e.message) || "구글 창이 닫혔습니다")),
    });
    cli.requestAccessToken();
  });
}

export function disconnect(forget) {
  token = null;
  /* 열쇠는 localStorage 에 둡니다 — 여기를 지워야 정말 끊깁니다.
     전에는 sessionStorage 를 지워, 죽은 열쇠가 남아 connected() 가 계속
     참이라 「다시 잇기」 단추가 안 나타났습니다. */
  try {
    localStorage.removeItem(KEY);
    if (forget) localStorage.removeItem(KEY + "-ok");   // 사람이 손수 끊을 때만
  } catch (e) {}
}

/* 저장된 열쇠만 봅니다.
   전에는 (token || saved()) 였는데, 모듈 변수 token 은 disconnect() 에서만
   비워집니다. 열쇠가 스스로 만료되면 saved() 는 null 이 되지만 죽은 token 이
   남아 계속 「이어져 있다」 고 답했고, 그래서 「다시 잇기」 단추가 그 탭에서
   영영 나타나지 않았습니다 — 바로 그 증상입니다. */
export const connected = () => !!saved();

/* 늘 살아 있는 열쇠를 돌려줍니다 — 만료가 다가오면 창 없이 미리 새로 받습니다.
   silent() 는 창을 띄우지 않으므로, 그것이 안 되면 마지막에 한 번만
   구글 창을 엽니다 (사람이 누른 자리에서 불려야 합니다). */
async function useToken() {
  const ok = saved(FRESH);
  if (ok) { token = ok; return ok; }
  const s = await silent();
  if (s) return s;
  return saved() || await connect();
}

/** 내가 쓰는 캘린더 목록 (숨긴 것은 뺍니다) */
export async function calendars(tok) {
  const t = tok || await useToken();
  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: "Bearer " + t } });
  if (r.status === 401 || r.status === 403) {
    disconnect();
    throw new Error("권한이 풀렸습니다. 다시 연결해 주세요.");
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


/* ── 일정 하나를 구글 「내 캘린더(primary)」 에 넣습니다 ──
   @param {date:"2026-09-02", time:"14:00"|"" , title, place}
   시각이 있으면 그때부터 한 시간, 없으면 종일로 넣습니다. */
export async function addEvent(ev) {
  const t = await useToken();
  const body = { summary: String(ev.title || "").slice(0, 200) };
  if (ev.place) body.location = String(ev.place).slice(0, 200);
  if (ev.time) {
    const beg = ev.date + "T" + ev.time + ":00";
    const [h, m] = ev.time.split(":").map(Number);
    const endH = String(Math.min(23, h + 1)).padStart(2, "0");
    body.start = { dateTime: beg, timeZone: "Asia/Seoul" };
    body.end   = { dateTime: ev.date + "T" + endH + ":" + String(m).padStart(2, "0") + ":00",
                   timeZone: "Asia/Seoul" };
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
      disconnect();
      throw new Error("구글이 쓰기를 막았습니다 — 「구글 달력 잇기」 를 다시 눌러 새 권한으로 이어 주세요.");
    }
    throw new Error("구글에 넣지 못했습니다 (" + r.status + ")");
  }
  return (await r.json()).id || "";
}
