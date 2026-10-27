import Link from 'next/link'
import release from '../../data/pmp-release.json'
import { BookArt } from './library/BookArt'

export function LearningAreas() {
  return (
    <section className="desk-shelf" aria-labelledby="desk-shelf-title">
      <div className="desk-shelf-heading">
        <h2 id="desk-shelf-title">공부 자료</h2>
        <span>5개 분야</span>
      </div>
      <div className="desk-books">
        <article className="desk-book book-cs">
          <Link className="desk-book-cover" href="/questions">
            <span className="book-edition">01 · CS 면접</span>
            <h3>컴퓨터과학</h3>
            <BookArt kind="cs" />
            <span className="book-cover-foot">
              질문과 해설 <span aria-hidden="true">↗</span>
            </span>
          </Link>
          <div className="desk-book-info">
            <p>면접 질문을 읽고, 모르는 개념은 관련 질문에서 찾아봅니다.</p>
            <Link className="desk-book-link" href="/questions">
              CS 질문 살펴보기 →
            </Link>
          </div>
        </article>
        <article className="desk-book book-pmp">
          <Link className="desk-book-cover" href="/learn/pmp">
            <span className="book-edition">02 · PMP</span>
            <h3 aria-label="프로젝트·제품 관리">
              프로젝트·
              <br />
              제품 관리
            </h3>
            <BookArt kind="pmp" />
            <span className="book-cover-foot">
              개념과 사례 <span aria-hidden="true">↗</span>
            </span>
          </Link>
          <div className="desk-book-info">
            <p>일정·비용·위험 관리부터 제품 조사와 실험까지 공부합니다.</p>
            <p className="study-meta">
              {release.stats.chapters}장 · {release.stats.lessons}수업 · v
              {release.version}
            </p>
            <Link className="desk-book-link" href="/learn/pmp">
              PMP 통합 자습서 열기 →
            </Link>
            <div className="desk-book-actions">
              <Link className="desk-book-link" href="/learn/pmp">
                장별 목차 보기 →
              </Link>
              <a
                className="desk-book-link"
                href={release.links.offline}
                download
              >
                오프라인 ZIP 받기 ↓
              </a>
            </div>
            <details className="desk-book-note">
              <summary>자료 안내</summary>
              <a className="desk-book-link" href={release.links.reader}>
                이전 전체 읽기 HTML →
              </a>
              <p className="study-meta">
                {release.asof} 기준의 학습용 자습서입니다. PMI 공식 교재나 공인
                교육시간 과정은 아닙니다. PMP 진도·메모는 CS 계정 기록과 별도로
                이 브라우저에 저장됩니다. 내려받은 파일은 자동 갱신되지
                않습니다.
              </p>
            </details>
          </div>
        </article>
        <article className="desk-book book-jira">
          <Link className="desk-book-cover" href="/learn/jira">
            <span className="book-edition">03 · Jira Cloud</span>
            <h3>Jira 실무</h3>
            <BookArt kind="jira" />
            <span className="book-cover-foot">
              작업 관리 연습 <span aria-hidden="true">↗</span>
            </span>
          </Link>
          <div className="desk-book-info">
            <p>가상 작업으로 상태 관리, JQL 검색, 변경 기록을 연습합니다.</p>
            <p className="study-meta">수업 10개 · JQL 연습 20개</p>
            <Link className="desk-book-link" href="/learn/jira">
              Jira 연습 시작하기 →
            </Link>
          </div>
        </article>
        <article className="desk-book book-engineer">
          <Link className="desk-book-cover" href="/learn/engineer">
            <span className="book-edition">04 · 기술사</span>
            <h3 aria-label="정보관리기술사">
              정보관리
              <br />
              기술사
            </h3>
            <BookArt kind="engineer" />
            <span className="book-cover-foot">
              개념과 답안 연습 <span aria-hidden="true">↗</span>
            </span>
          </Link>
          <div className="desk-book-info">
            <p>개념과 참고 답안을 읽고, 기출을 찾아 직접 답안을 씁니다.</p>
            <p className="study-meta">개념 24개 · 기출 색인 1,860개</p>
            <Link className="desk-book-link" href="/learn/engineer">
              개념·기출 공부하기 →
            </Link>
          </div>
        </article>
        <article className="desk-book book-certificate">
          <Link className="desk-book-cover" href="/learn/certificate">
            <span className="book-edition">05 · 정처기 이론</span>
            <h3>
              정보처리기사
              <br />
              DB·SQL
            </h3>
            <BookArt kind="certificate" />
            <span className="book-cover-foot">
              개념과 창작 예시 <span aria-hidden="true">↗</span>
            </span>
          </Link>
          <div className="desk-book-info">
            <p>표와 제약조건부터 정규화·조인·NULL까지 예제로 설명합니다.</p>
            <p className="study-meta">첫 묶음 12수업 · 기출·복원 코드 제외</p>
            <Link className="desk-book-link" href="/learn/certificate">
              정처기 이론 읽기 →
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}
