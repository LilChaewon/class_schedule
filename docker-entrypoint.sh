#!/bin/sh
# 환경변수로부터 /config.js 를 생성. (nginx:alpine 기본 entrypoint 가 기동 전에 실행)
set -eu

CONFIG_PATH="/usr/share/nginx/html/config.js"

cat > "$CONFIG_PATH" <<EOF
// 이 파일은 컨테이너 기동 시 자동 생성됩니다. 직접 수정하지 마세요.
window.__ENV__ = {
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  APP_ENV: "${APP_ENV:-docker}",
  RELEASE: "${RELEASE:-dev}"
};
EOF

echo "[entrypoint] config.js 생성 완료 (SUPABASE_URL=${SUPABASE_URL:+set})"
