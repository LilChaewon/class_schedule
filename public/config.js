// 런타임 환경설정. 기본값은 비활성(에러 리포팅 OFF) — 로컬에서 그냥 열어도 동작합니다.
// Docker 컨테이너 기동 시 docker-entrypoint.sh 가 환경변수(SUPABASE_URL 등)로 이 파일을 덮어씁니다.
// 빌드 없이 쓰는 정적 앱이라, 여기엔 공개되어도 되는 anon 키만 넣으세요 (service_role 키 금지).
window.__ENV__ = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  APP_ENV: "local",
  RELEASE: "dev"
};
