import Link from 'next/link'
import release from '../../data/pmp-release.json'

export function LearningAreas() {
  return (
    <section className="desk-shelf" aria-labelledby="desk-shelf-title">
      <h2 id="desk-shelf-title">공부 자료</h2>
      <article className="desk-book">
        <p className="desk-book-number">01</p>
        <div>
          <h3>
            <Link href="/questions">
              컴퓨터과학 <span aria-hidden="true">↗</span>
            </Link>
          </h3>
          <p>
            면접 질문과 해설을 읽고, 모르는 개념은 관련 질문에서 찾아봅니다.
          </p>
          <Link className="desk-book-link" href="/questions">
            CS 질문 살펴보기 →
          </Link>
        </div>
      </article>
      <article className="desk-book">
        <p className="desk-book-number">02</p>
        <div>
          <h3>
            <a href={release.links.study}>
              프로젝트·제품 관리 <span aria-hidden="true">↗</span>
            </a>
          </h3>
          <p>일정·비용·위험 관리부터 제품 조사와 실험까지 사례로 공부합니다.</p>
          <p className="study-meta">
            {release.stats.chapters}장 · {release.stats.lessons}수업 ·{' '}
            {release.stats.questions}개 연습 문제 · 자료 v{release.version}
          </p>
          <div className="desk-book-actions">
            <a className="desk-book-link" href={release.links.study}>
              PMP 통합 자습서 열기 →
            </a>
            <a className="desk-book-link" href={release.links.reader}>
              전체 읽기 열기 →
            </a>
            <a className="desk-book-link" href={release.links.offline} download>
              오프라인 ZIP 받기 ↓
            </a>
          </div>
          <details className="desk-book-note">
            <summary>자료 안내</summary>
            <p className="study-meta">
              {release.asof} 기준의 학습용 자습서입니다. PMI 공식 교재나 공인
              교육시간 과정은 아닙니다. PMP 진도·메모는 CS 계정 기록과 별도로 이
              브라우저에 저장됩니다. 내려받은 파일은 자동 갱신되지 않습니다.
            </p>
          </details>
        </div>
      </article>
      <article className="desk-book">
        <p className="desk-book-number">03</p>
        <div>
          <h3>
            <Link href="/learn/jira">
              Jira 실무 <span aria-hidden="true">↗</span>
            </Link>
          </h3>
          <p>가상 작업으로 상태 관리, JQL 검색, 변경 기록을 연습합니다.</p>
          <p className="study-meta">
            수업 10개 · JQL 연습 20개 · 연습 과제 5개
          </p>
          <Link className="desk-book-link" href="/learn/jira">
            Jira 연습 시작하기 →
          </Link>
        </div>
      </article>
      <article className="desk-book">
        <p className="desk-book-number">04</p>
        <div>
          <h3>
            <Link href="/learn/engineer">
              정보관리기술사 <span aria-hidden="true">↗</span>
            </Link>
          </h3>
          <p>
            분야별 개념과 참고 답안을 읽고, 회차별 기출을 찾아 답안을 씁니다.
          </p>
          <p className="study-meta">
            개념 24개 · 기출 색인 1,860개 · 원문 제공 31문항
          </p>
          <Link className="desk-book-link" href="/learn/engineer">
            개념·기출 공부하기 →
          </Link>
        </div>
      </article>
    </section>
  )
}
