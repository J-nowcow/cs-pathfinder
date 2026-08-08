-- 번호가 새는 것을 막는다.
--
-- `0010`에서 `number`에 `default nextval(...)`을 걸었다. 그런데 부팅 시드가
-- 이렇게 넣는다.
--
--   insert into qnode (id, ...) values (...)
--     on conflict (id) do update ...
--
-- `number`를 안 적었으니 **DEFAULT가 평가된다. 충돌 검사보다 먼저.** 이미
-- 있는 행이어도 `nextval`이 돌고, 시퀀스는 트랜잭션을 안 타므로 되돌지도
-- 않는다. 부팅 한 번에 시드 개수만큼 번호가 사라진다.
--
-- 실측: 행 283개에 시퀀스가 29763까지 갔다. 29,480개가 샜다. 새 질문이
-- `/q/28728`을 받았다 -- `/q/3` 같은 짧은 주소가 이 서비스의 값인데 그것을
-- 깎는다.
--
-- 그래서 DEFAULT를 뗀다. 번호는 **행이 실제로 생긴 뒤에** 코드가 붙인다.
alter table qnode alter column number drop default;

-- 혹시 비어 있는 것이 있으면 채운다. 없어야 정상이다.
update qnode set number = nextval('qnode_number_seq') where number is null;

-- 시퀀스를 작은 값으로 되돌린다.
--
-- **이미 나간 번호는 안 건드린다.** 19836·25425·28728~28731이 이미 주소로
-- 살아 있고, 다시 매기면 옛 링크가 엉뚱한 질문으로 간다(`0010` 주석 참조).
--
-- 대신 앞으로 나갈 번호를 작게 만든다. 작은 쪽 최댓값이 277이므로 278부터
-- 19835까지 19,558개가 비어 있다. 그 안에서는 부딪히지 않고, 부딪히더라도
-- 유니크 인덱스가 잡는다.
-- 빈 표에서는 `is_called`를 거짓으로 둬야 **첫 번호가 1**이 된다. 참으로 두면
-- 1을 이미 쓴 것으로 쳐서 2부터 나간다. 새 시험 DB가 그래서 깨졌다.
select setval(
  'qnode_number_seq',
  greatest(coalesce((select max(number) from qnode where number < 1000), 0), 1),
  (select count(*) > 0 from qnode where number < 1000)
);
