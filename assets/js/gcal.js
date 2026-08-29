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

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const KEY = "skyish-gcal-token";

let token = null;

function saved() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (v && v.exp > Date.now()) return v.token;
  } catch (e) {}
  return null;
}
function keep(t, sec) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      token: t, exp: Date.now() + (sec - 60) * 1000,
    }));
  } catch (e) {}
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
      prompt: force ? "consent" : "",
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

export function disconnect() {
  token = null;
  try { sessionStorage.removeItem(KEY); } catch (e) {}
}

export const connected = () => !!(token || saved());

/**
 * 한 달치 일정을 받아 옵니다.
 * @returns [{date:"2026-08-14", title, place, allDay}]
 */
export async function month(year, mon0) {
  const t = token || saved() || await connect();
  const from = new Date(year, mon0, 1);
  const to = new Date(year, mon0 + 1, 1);
  const u = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    + "?singleEvents=true&orderBy=startTime&maxResults=250"
    + "&timeMin=" + encodeURIComponent(from.toISOString())
    + "&timeMax=" + encodeURIComponent(to.toISOString());

  const r = await fetch(u, { headers: { Authorization: "Bearer " + t } });
  if (r.status === 401 || r.status === 403) {
    disconnect();
    throw new Error("권한이 풀렸습니다. 다시 연결해 주세요.");
  }
  if (!r.ok) throw new Error("일정을 받지 못했습니다 (HTTP " + r.status + ")");

  const j = await r.json();
  return (j.items || []).map((e) => {
    const s = e.start || {};
    const day = s.date || (s.dateTime || "").slice(0, 10);
    return {
      date: day,
      title: e.summary || "(제목 없음)",
      place: e.location || "",
      allDay: !!s.date,
      time: s.dateTime ? s.dateTime.slice(11, 16) : "",
    };
  }).filter((x) => x.date);
}
