-- 할당량 증감은 반드시 이 함수들 안에서만 한다.
-- 애플리케이션이 읽고 쓰면 동시 요청 시 카운터가 샌다.
-- 날짜는 KST 자정 기준으로 리셋한다.

create or replace function quota_today() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create or replace function quota_reserve(p_key text, p_limit int)
returns boolean
language plpgsql as $$
declare
  v_date date := quota_today();
  v_total int;
begin
  insert into usage_quota (key, date, used, reserved)
  values (p_key, v_date, 0, 0)
  on conflict (key, date) do nothing;

  -- 행 잠금으로 동시 예약을 직렬화한다.
  select used + reserved into v_total
  from usage_quota
  where key = p_key and date = v_date
  for update;

  if v_total >= p_limit then
    return false;
  end if;

  update usage_quota
  set reserved = reserved + 1
  where key = p_key and date = v_date;

  return true;
end;
$$;

create or replace function quota_commit(p_key text)
returns void
language plpgsql as $$
declare
  v_date date := quota_today();
begin
  update usage_quota
  set reserved = greatest(reserved - 1, 0),
      used = used + 1
  where key = p_key and date = v_date;
end;
$$;

create or replace function quota_release(p_key text)
returns void
language plpgsql as $$
declare
  v_date date := quota_today();
begin
  update usage_quota
  set reserved = greatest(reserved - 1, 0)
  where key = p_key and date = v_date;
end;
$$;

create or replace function quota_get(p_key text)
returns table (used int, reserved int)
language sql stable as $$
  select coalesce(max(q.used), 0)::int, coalesce(max(q.reserved), 0)::int
  from usage_quota q
  where q.key = p_key and q.date = quota_today()
$$;

-- single-flight.
-- 삽입에 성공한 세션만 리스 소유자다. row_count로 판별한다.
create or replace function generation_acquire(p_hash text, p_seconds int)
returns table (result text, qnode_id uuid)
language plpgsql as $$
declare
  v_count int := 0;
  v_row generation_job%rowtype;
begin
  insert into generation_job (normalized_hash, status, lease_until)
  values (p_hash, 'running', now() + make_interval(secs => p_seconds))
  on conflict (normalized_hash) do nothing;

  get diagnostics v_count = row_count;
  if v_count > 0 then
    return query select 'acquired'::text, null::uuid;
    return;
  end if;

  select * into v_row from generation_job
  where normalized_hash = p_hash
  for update;

  if v_row.status = 'done' then
    return query select 'done'::text, v_row.qnode_id;
    return;
  end if;

  -- 리스가 만료됐거나 이전 시도가 실패했으면 회수한다.
  if v_row.lease_until <= now() or v_row.status = 'failed' then
    update generation_job
    set status = 'running',
        lease_until = now() + make_interval(secs => p_seconds),
        updated_at = now()
    where normalized_hash = p_hash;
    return query select 'acquired'::text, null::uuid;
    return;
  end if;

  return query select 'busy'::text, null::uuid;
end;
$$;

create or replace function generation_complete(p_hash text, p_qnode_id uuid)
returns void
language sql as $$
  update generation_job
  set status = 'done', qnode_id = p_qnode_id, updated_at = now()
  where normalized_hash = p_hash
$$;

create or replace function generation_fail(p_hash text)
returns void
language sql as $$
  update generation_job
  set status = 'failed', lease_until = now(), updated_at = now()
  where normalized_hash = p_hash
$$;
