-- 시간표 마법사 — 캠퍼스(자연캠퍼스/인문캠퍼스) 구분 지원
-- 적용: Supabase 대시보드 SQL Editor 에 붙여넣고 Run (또는 supabase db push)

-- 1) campus 컬럼 추가. 기존 행은 전부 자연캠퍼스 데이터이므로 기본값으로 자동 백필됨.
alter table public.course_catalog
  add column if not exists campus text not null default '자연캠퍼스';

-- 2) "활성 카탈로그는 1건" 제약을 전체 1건 → 캠퍼스별 1건으로 변경.
--    (부분 유니크 인덱스: active=true 인 행만 캠퍼스별로 유일해야 함)
create unique index if not exists course_catalog_one_active_per_campus
  on public.course_catalog(campus) where active;

-- 3) save_catalog: 캠퍼스별로 교체 저장하도록 p_campus 인자 추가.
--    기존 4-인자 함수는 제거하고 5-인자(p_campus 기본값 '자연캠퍼스')로 재생성.
drop function if exists public.save_catalog(text, text, jsonb, int);

create or replace function public.save_catalog(
  p_password text, p_label text, p_data jsonb, p_count int, p_campus text default '자연캠퍼스')
returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if p_password is distinct from (select password from admin_secret where id = 1) then
    raise exception 'unauthorized';
  end if;
  update course_catalog set active = false where active and campus = p_campus;
  insert into course_catalog(label, data, active, course_count, campus)
    values (p_label, p_data, true, p_count, p_campus) returning id into new_id;
  return new_id;
end; $$;

revoke all on function public.save_catalog(text, text, jsonb, int, text) from public;
grant execute on function public.save_catalog(text, text, jsonb, int, text) to anon;
