-- 시간표 마법사 — 브라우저 런타임 오류 수집 테이블
-- 적용: `supabase db push`  또는  Supabase 대시보드 SQL Editor 에 붙여넣기

create table if not exists public.error_logs (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  kind         text not null,                 -- error | unhandledrejection | manual
  message      text not null,
  stack        text,
  source       text,
  line         int,
  col          int,
  url          text,
  user_agent   text,
  app_env      text,                           -- local | docker | production ...
  release      text,
  fingerprint  text,                           -- 중복 묶기용 지문
  resolved     boolean not null default false  -- 분석/처리 완료 표시
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_fingerprint_idx on public.error_logs (fingerprint);

alter table public.error_logs enable row level security;

-- anon(브라우저)은 INSERT 만 가능 — 읽기/수정은 service_role(서버·CI)만.
drop policy if exists "anon can insert error logs" on public.error_logs;
create policy "anon can insert error logs"
  on public.error_logs for insert
  to anon
  with check (true);

-- (선택) 분석 결과를 누적 저장하고 싶을 때 사용하는 테이블
create table if not exists public.error_reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  window_from timestamptz,
  window_to   timestamptz,
  error_count int,
  summary     text,             -- Claude 가 생성한 요약/원인분석/권고
  model       text
);
alter table public.error_reports enable row level security;
-- error_reports 는 anon 정책 없음 → service_role 만 접근.
