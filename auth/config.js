// ─── Supabase 연결 설정 ───────────────────────────────
// utokyo-kr(u-tokyo.kr) 과 같은 프로젝트를 함께 씁니다.
// publishable key 는 브라우저에 노출되도록 설계된 공개 키입니다.
// 실제 접근 제어는 Supabase 의 RLS(행 단위 보안) 정책이 담당합니다.
export const SUPABASE_URL = "https://ojnukcciozchnsycxtfq.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Sa7S4MKqYbC4gX76QTAjDw_qKqW8rR_";

// 분석 자료가 들어 있는 비공개 Storage 버킷 이름
export const ANALYSIS_BUCKET = "analysis";
