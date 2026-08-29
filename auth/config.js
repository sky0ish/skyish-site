// ─── Supabase 연결 설정 ───────────────────────────────
// skyish.kr 전용 프로젝트입니다 (u-tokyo.kr 과 분리).
// publishable key 는 브라우저에 노출되도록 설계된 공개 키입니다.
// 실제 접근 제어는 Supabase 의 RLS(행 단위 보안) 정책이 담당합니다.
export const SUPABASE_URL = "https://qmdovjlxfvinknuizelw.supabase.co";
export const SUPABASE_KEY = "sb_publishable_apVDoDrUDbKJTnlSyEbhlw_jhMSiUnd";

// 분석 자료가 들어 있는 비공개 Storage 버킷 이름
export const ANALYSIS_BUCKET = "analysis";

// ─── 구글 캘린더 불러오기 ───────────────────────────────
// 비워 두면 캘린더 단추가 「연결 설정이 필요합니다」 로 나옵니다.
// 만드는 방법은 assets/js/gcal.js 맨 위 주석에 적어 두었습니다.
// 이 값은 브라우저에 드러나도 되는 공개 값입니다
// (승인된 원본이 skyish.kr 로 묶여 있어 다른 곳에서는 쓸 수 없습니다).
export const GCAL_CLIENT_ID = "";
