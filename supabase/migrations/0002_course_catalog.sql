-- 시간표 마법사 — 강의 카탈로그(관리자가 CSV 업로드로 교체) + 비밀번호 게이트
-- 적용: Supabase 대시보드 SQL Editor 에 붙여넣고 Run (또는 supabase db push)

-- 1) 카탈로그: 파싱된 강의 데이터(JSON). active=true 인 1건이 앱에 노출됨.
create table if not exists public.course_catalog (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  label        text not null,            -- 예: "2026-1"
  course_count int,
  data         jsonb not null,           -- window.COURSES 와 같은 형식의 배열
  active       boolean not null default false
);
create index if not exists course_catalog_active_idx on public.course_catalog(active);

alter table public.course_catalog enable row level security;
-- 공개(anon): 활성 카탈로그 "읽기"만 허용. 쓰기는 불가(아래 RPC로만).
drop policy if exists "anon read active catalog" on public.course_catalog;
create policy "anon read active catalog"
  on public.course_catalog for select to anon using (active = true);

-- 2) 관리자 비밀번호 (anon 정책 없음 → 외부에서 못 읽음)
create table if not exists public.admin_secret (
  id       int primary key default 1,
  password text not null
);
alter table public.admin_secret enable row level security;

-- ▼▼▼ 비밀번호를 원하는 값으로 바꾸세요 ▼▼▼
insert into public.admin_secret(id, password) values (1, 'CHANGE_ME')
  on conflict (id) do update set password = excluded.password;
-- ▲▲▲

-- 3) 비번 검증 후 카탈로그 교체 (SECURITY DEFINER → RLS 우회하여 서버단에서 안전하게 쓰기)
create or replace function public.save_catalog(
  p_password text, p_label text, p_data jsonb, p_count int)
returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if p_password is distinct from (select password from admin_secret where id = 1) then
    raise exception 'unauthorized';
  end if;
  update course_catalog set active = false where active;
  insert into course_catalog(label, data, active, course_count)
    values (p_label, p_data, true, p_count) returning id into new_id;
  return new_id;
end; $$;

-- 4) 비번 확인용 (관리자 페이지 로그인 체크)
create or replace function public.check_admin(p_password text)
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from admin_secret where id = 1 and password = p_password);
$$;

revoke all on function public.save_catalog(text,text,jsonb,int) from public;
grant execute on function public.save_catalog(text,text,jsonb,int) to anon;
grant execute on function public.check_admin(text) to anon;
