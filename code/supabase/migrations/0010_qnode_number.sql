-- 질문에 사람이 읽는 번호를 붙인다.
--
-- 지금 주소는 `/q/5d9cb401-d07f-46db-885b-c2a94c063919`다. 레포 파일이나 이슈에
-- 적으면 한 줄을 다 잡아먹고, 사람이 서로 "그 36자짜리"라고 부를 수가 없다.
--
-- **UUID를 없애지 않는다.** 이미 공유된 링크가 그 주소를 쓰고 있고 공유가 이
-- 서비스의 핵심이다. 번호는 짧은 별명으로 더한다.
--
-- 번호는 `created_at` 순이다. 오래된 질문이 1번이라 나중에 뭘 지워도 앞 번호가
-- 안 흔들린다. 삭제하면 그 번호는 빈 채로 남는다 -- 재사용하면 옛 링크가 엉뚱한
-- 질문으로 간다.
alter table qnode add column if not exists number integer;

-- 이미 있는 것에 순서대로 매긴다. 같은 시각이면 id로 갈라 매번 같은 결과가 나온다.
update qnode q
   set number = t.n
  from (
    select id, row_number() over (order by created_at asc, id asc) as n
      from qnode
     where number is null
  ) t
 where q.id = t.id
   and q.number is null;

-- 번호는 겹치면 안 된다. 겹치면 `/q/42`가 어느 것인지 정할 수 없다.
create unique index if not exists qnode_number_key on qnode (number);

-- 새로 들어오는 것에 자동으로 다음 번호를 준다.
--
-- `max(number) + 1`을 쓰지 않는다. 두 요청이 동시에 들어오면 같은 값을 읽어
-- 같은 번호를 매기고, 유니크 인덱스에서 하나가 죽는다. 시퀀스는 그런 일이 없다.
create sequence if not exists qnode_number_seq;
select setval('qnode_number_seq', coalesce((select max(number) from qnode), 0) + 1, false);
alter table qnode alter column number set default nextval('qnode_number_seq');
