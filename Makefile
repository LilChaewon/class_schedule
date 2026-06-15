# 시간표 마법사 — 자주 쓰는 명령 모음
.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help up down restart logs build smoke db-push analyze

help: ## 명령 목록 보기
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## 앱 실행 (http://localhost:8080)
	$(COMPOSE) up -d --build
	@echo "→ http://localhost:$${PORT:-8080} 에서 열어보세요"

down: ## 앱 종료 + 정리
	$(COMPOSE) down

restart: down up ## 재시작

logs: ## 로그 보기
	$(COMPOSE) logs -f

build: ## 이미지만 빌드
	$(COMPOSE) build

smoke: ## 떠 있는 앱에 스모크 테스트
	@curl -fsS http://localhost:$${PORT:-8080}/healthz && echo " ✓ healthz" || (echo " ✗ healthz 실패"; exit 1)
	@curl -fsS http://localhost:$${PORT:-8080}/ | grep -q "시간표 마법사" && echo " ✓ index" || (echo " ✗ index 실패"; exit 1)

db-push: ## Supabase 마이그레이션 적용 (supabase CLI 필요)
	supabase db push

analyze: ## 최근 에러 로그를 Claude 로 분석 (env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)
	node scripts/analyze-errors.mjs
