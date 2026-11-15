import { StudyPoc } from './StudyPoc'

export function StudyLessonContent({ publicLesson = false }: { publicLesson?: boolean }) {
  return <>
    <StudyPoc publicLesson={publicLesson} />
    <noscript>
      <article className="study-poc sp-nojs">
        <p>CS 길라잡이 · 읽기 모드</p>
        <h1>DB 연결부터 살펴보기</h1>
        <h2>1. 연결</h2><p>DB는 앱의 데이터를 저장하는 곳입니다. 연결 C1을 열면 앱과 DB가 명령과 결과를 주고받습니다. SQL은 DB에 보내는 명령입니다. 첫 조회 요청 R1은 counters 표에서 id가 7인 행의 value를 읽어 0을 받습니다. 행은 자료 한 건이며 id는 행을 구분하는 번호, value는 저장된 숫자입니다.</p>
        <h2>2. 풀</h2><p>앱이 C1을 풀에 반납하면 열린 채 보관됩니다. 다음 요청이 같은 C1을 빌려 씁니다. 최대 연결 수를 모두 사용 중이면 다음 요청은 앱에서 기다립니다.</p>
        <h2>3. 트랜잭션</h2><p>이제 숫자를 1 늘리는 새 요청 3개를 보며 요청과 연결 번호도 다시 시작합니다. 트랜잭션은 함께 확정할 DB 작업 묶음입니다. R1은 C1에서 BEGIN으로 시작하고 UPDATE로 counters의 7번 행 값을 1 늘립니다. COMMIT은 변경을 확정하는 명령입니다. 이 장면에서는 앱이 아직 COMMIT을 보내지 않아 UPDATE가 끝난 뒤에도 변경은 미확정입니다.</p>
        <h2>4. 락(잠금)</h2><p>R1은 트랜잭션이 끝날 때까지 수정한 행의 잠금을 보유합니다. R2가 C2로 같은 행을 UPDATE하면 잠금을 기다립니다. COMMIT은 변경을 확정하고 ROLLBACK은 변경을 취소하며 둘 다 트랜잭션을 끝내고 잠금을 풉니다. C1은 앱이 반납할 때까지 계속 점유합니다.</p>
        <h2>5. 대기</h2><p>풀이 최대 2개이면 C1과 C2를 모두 사용하므로 R3는 풀에서 기다립니다. 상한을 3개로 늘리면 R3가 C3를 빌릴 수 있지만 같은 행의 UPDATE는 잠금을 기다립니다. 다른 잠금이 없는 다른 행의 UPDATE는 이 행 잠금 때문에 기다리지 않습니다.</p>
        <details><summary>예시의 조건과 보충 실험</summary><p>PostgreSQL의 Read Committed에서 키가 아닌 value 열을 수정하며 다른 경합·오류·시간 초과는 제외합니다. 일반 SELECT는 이 UPDATE의 행 잠금에 보통 같은 방식으로 기다리지 않습니다. 잠금 획득 순서는 실행 예시이며 일반적인 선입선출 보장이 아닙니다.</p><p>보충 실험은 행 잠금 대기를 제외하고 DB 동시 처리 한도를 정합니다. DB 조회 요청 12개가 동시에 도착하고 요청당 3초, DB가 최대 3개씩 처리한다고 가정합니다. 연결 2개면 6묶음×3초=18초, 연결 6개면 DB 처리 한도로 4묶음×3초=12초입니다. 실제 측정값은 아닙니다.</p><p>연결 재사용은 네트워크 연결·인증·세션 준비를 줄입니다. 질의 시간과 대기는 따로 확인합니다.</p></details>
        <h2>원문 근거</h2>
        <ul><li><a href="https://www.postgresql.org/docs/current/tutorial-transactions.html">PostgreSQL: 트랜잭션</a></li><li><a href="https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS">PostgreSQL: 행 잠금</a></li><li><a href="https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing">HikariCP: 풀 크기의 조건과 한계</a></li><li><a href="https://www.postgresql.org/docs/current/runtime-config-connection.html">PostgreSQL: 연결 한도와 자원</a></li></ul>
        <p>슬라이더를 조작하고 학습 기록을 저장하려면 JavaScript를 켜 주세요.</p>
        <a href="/questions">기존 CS 질문 목록으로</a>
      </article>
    </noscript>
  </>
}
