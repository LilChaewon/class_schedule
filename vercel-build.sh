#!/bin/sh
# Vercel 빌드 단계: 프로젝트 환경변수로부터 public/config.js 생성.
# (Docker 의 docker-entrypoint.sh 와 같은 역할 — Supabase 키를 git 에 박지 않기 위함)
set -eu

cat > public/config.js <<EOF
// Vercel 빌드 시 자동 생성됩니다. 직접 수정하지 마세요.
window.__ENV__ = {
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  APP_ENV: "${APP_ENV:-production}",
  RELEASE: "${VERCEL_GIT_COMMIT_SHA:-prod}"
};
EOF

echo "[vercel-build] config.js 생성 완료 (SUPABASE_URL=${SUPABASE_URL:+set})"
