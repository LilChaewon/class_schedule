# 시간표 마법사 (Timetable Wizard)

**🔗 배포 링크: https://classschedule-ten.vercel.app**

실제 강의 데이터를 기반으로, 과목을 직접 담아
시간표를 짜거나 **마법사**로 모든 조합을 자동 생성해 최적의 시간표를 찾아주는 웹앱.

- **내 시간표(홈)** — `과목 추가`로 분반을 골라 바로 올리고, 블록의 ×로 빼기. 시간 충돌 자동 차단.
- **마법사** — 그룹마다 비슷한 과목(예: 채플 6개 분반)을 묶어 `택 1` → 모든 조합 중 충돌 없는
  시간표만 계산 → 썸네일에서 골라 내 시간표로 불러오기.
- **검색** — 과목명·교수·학수번호·학부, 전공(대학›학부›전공 트리)·교양(영역)·학년·시간(요일×시간 격자) 필터.
- **내보내기** — 완성된 시간표를 이미지(PNG) / PDF 로 저장.
- 전공은 쿨톤, 교양은 웜톤으로 색 자동 배정.

> 디자인 원본은 Claude Design 핸드오프 번들(`시간표 마법사.html` 외)이며, 동작하는
> React(+Babel) 프로토타입을 그대로 정적 앱으로 서빙합니다. 빌드 단계가 없습니다.

---

## 1. 로컬 실행 (Docker Compose 하나로)

```bash
docker compose up      # 실행  →  http://localhost:8080
docker compose down    # 종료
```

또는 `make` 단축 명령:

```bash
make up      # 빌드 후 백그라운드 실행
make down    # 종료
make smoke   # 떠 있는 앱 스모크 테스트
make logs    # 로그
make help    # 전체 명령
```

포트를 바꾸려면 `PORT=3000 docker compose up` 처럼 지정하거나 `.env` 에 `PORT=` 설정.

### 구성
- `public/` — 정적 앱 (index.html, *.jsx, lib.js, courses.js, styles.css …)
- `Dockerfile` / `nginx.conf` — nginx 로 `public/` 서빙, `/healthz` 헬스체크 제공
- `docker-entrypoint.sh` — 컨테이너 기동 시 환경변수로 `public/config.js` 생성
  (Supabase 키 주입). 키가 없으면 에러 리포팅은 자동으로 꺼진 채 정상 동작.

---

## 2. CI/CD + 오류 로그 자동 분석 (Supabase + GitHub Actions)

### 2-1. Supabase 준비 (오류 수집함)
1. Supabase 프로젝트 생성.
2. 스키마 적용: `supabase db push` (또는 대시보드 SQL Editor 에 `supabase/migrations/0001_error_logs.sql` 붙여넣기).
   - `error_logs` 테이블 + RLS(anon 은 INSERT 만 허용) + `error_reports`(분석 결과 누적).
3. 브라우저가 오류를 보내도록 키 주입 — 둘 중 하나:
   - 로컬/도커: `.env` 에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 설정 후 `docker compose up`.
   - 배포: 호스팅 환경변수로 동일 값 주입(컨테이너가 `config.js` 를 생성).

브라우저에서 미처리 예외/리젝션이 발생하면 `public/error-reporter.js` 가 PostgREST 로
`error_logs` 에 INSERT 합니다 (중복 지문 억제, 세션당 상한 있음).

### 2-2. GitHub Actions
- **`.github/workflows/ci.yml`** — push/PR 마다 Docker 이미지 빌드 → 기동 → `/healthz`·
  index·에셋 스모크 테스트, 그리고 모든 `.jsx`/`.js` 구문 검사.
- **`.github/workflows/error-analysis.yml`** — 매일 09:00 KST(+수동 실행).
  `scripts/analyze-errors.mjs` 가 최근 N시간 `error_logs` 를 빈도순으로 묶어
  **Claude(claude-opus-4-8)** 로 *Top 원인 / 살펴볼 코드 위치 / 노이즈 구분* 을 요약 →
  `error_reports` 에 저장하고, GitHub 잡 요약 + 아티팩트(`report.md`)로 출력.

필요한 **Repository Secrets**:

| Secret | 용도 |
|---|---|
| `SUPABASE_URL` | 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 로그 읽기/리포트 쓰기 (CI 전용, 절대 브라우저에 노출 금지) |
| `ANTHROPIC_API_KEY` | Claude 분석 (없으면 빈도 집계만) |

로컬에서 분석을 직접 돌리려면:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... make analyze
```

### 2-3. Supabase MCP 로 자동화 (선택)
Supabase 는 공식 **MCP 서버**를 제공합니다. Claude Code/Desktop 에 Supabase MCP 를 연결하면
사람이 SQL 을 안 짜고도 자연어로
"`error_logs` 에서 어제 가장 많이 난 오류 5개 보여줘", "그 오류 `resolved=true` 로 표시해줘"
같은 운영 작업을 시킬 수 있습니다. 본 저장소의 GitHub Actions 자동 분석과 함께 쓰면
*수집(브라우저) → 저장(Supabase) → 분석(Claude/CI) → 운영(MCP)* 루프가 완성됩니다.

```
브라우저 오류 ──▶ error_reporter.js ──▶ Supabase error_logs
                                              │
              GitHub Actions (매일) ──────────┤── analyze-errors.mjs ──▶ Claude ──▶ error_reports + 잡 요약
                                              │
              Claude + Supabase MCP ──────────┘  (자연어로 조회·운영)
```

---


## 배포 (Vercel)

정적 앱이라 빌드 시 `vercel-build.sh` 가 환경변수로 `config.js` 를 생성해 서빙합니다.

- 배포 URL: **https://classschedule-ten.vercel.app**
- 재배포: `vercel --prod` (Vercel 프로젝트: `lilchaewons-projects/class_schedule`)
- Vercel 프로젝트 환경변수(Production): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_ENV`
  (※ `service_role` 키는 Vercel 에 넣지 않습니다 — 프론트엔드에 필요 없음)
- Deployment Protection 은 공개 접속을 위해 해제돼 있습니다.
- GitHub 자동배포를 원하면 Vercel 대시보드 → Project → Settings → Git 에서 저장소 연결.

## 환경변수 요약
`.env.example` 참고 (`cp .env.example .env`).

| 변수 | 위치 | 설명 |
|---|---|---|
| `PORT` | compose | 노출 포트 (기본 8080) |
| `SUPABASE_URL` | 브라우저 config.js | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 브라우저 config.js | anon 키(공개 가능, INSERT 전용) |
| `SUPABASE_SERVICE_ROLE_KEY` | CI Secret | 로그 읽기/리포트 쓰기 |
| `ANTHROPIC_API_KEY` | CI Secret / 로컬 | Claude 분석 |
