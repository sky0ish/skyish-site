// ─── Supabase 연결 설정 ───────────────────────────────
// skyish.kr 전용 프로젝트입니다 (u-tokyo.kr 과 분리).
// publishable key 는 브라우저에 노출되도록 설계된 공개 키입니다.
// 실제 접근 제어는 Supabase 의 RLS(행 단위 보안) 정책이 담당합니다.
export const SUPABASE_URL = "https://qmdovjlxfvinknuizelw.supabase.co";
export const SUPABASE_KEY = "sb_publishable_apVDoDrUDbKJTnlSyEbhlw_jhMSiUnd";

// 분석 자료가 들어 있는 비공개 Storage 버킷 이름
export const ANALYSIS_BUCKET = "analysis";
