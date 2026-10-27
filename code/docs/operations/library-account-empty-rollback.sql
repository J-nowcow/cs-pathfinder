-- Review-only rollback: never executed by the application or migration runner.
-- Disable rollout first. Nonempty tables require a protected backup and separate
-- explicit deletion approval; this script intentionally refuses that case.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
do $$
begin
  if to_regclass('public.library_study_snapshot') is not null then
    if exists (select 1 from library_study_snapshot) then
      raise exception 'Library snapshots exist; preserve data and obtain separate deletion approval';
    end if;
  end if;
end $$;
drop table if exists library_study_write;
drop table if exists library_study_snapshot;
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    delete from schema_migrations where name = '0022_library_study.sql';
  end if;
end $$;
commit;
