import Link from 'next/link'
import release from '../../data/pmp-release.json'
import { BookArt } from './library/BookArt'

export function LearningAreas() {
  return (
    <section className="desk-shelf" aria-labelledby="desk-shelf-title">
      <div className="desk-shelf-heading">
        <h2 id="desk-shelf-title">공부 자료</h2>
        <span>공부할 목적부터 고르세요</span>
      </div>
      <div className="desk-purpose-grid">
        <section
          className="desk-purpose-card book-pmp"
          aria-labelledby="purpose-pm"
        >
          <header>
            <h3 id="purpose-pm">PM 이론</h3>
            <p>프로젝트와 제품을 만드는 일</p>
            <BookArt kind="pmp" />
          </header>
          <div className="desk-purpose-body">
            <p>계획·실행·성과를 이해하고 가상 작업에 적용합니다.</p>
            <ul>
              <li>
                <Link href="/learn/pmp">
                  <strong>프로젝트·제품 관리 →</strong>
                  <span>PMP 개념·사례·계산 실습</span>
                </Link>
              </li>
              <li>
                <Link href="/learn/jira">
                  <strong>Jira 실무 연습 →</strong>
                  <span>작업 흐름·JQL·변경 기록</span>
                </Link>
              </li>
            </ul>
            <details className="desk-purpose-downloads">
              <summary>PMP 오프라인 자료·안내</summary>
              <a href={release.links.offline} download>
                오프라인 ZIP 받기 ↓
              </a>
              <a href={release.links.reader}>이전 전체 읽기 HTML →</a>
              <p>
                {release.asof} 확인본입니다. PMI 공식 교재나 공인 교육시간
                과정은 아닙니다. PMP 진도·메모는 CS 계정 기록과 별도로 이
                브라우저에 저장됩니다. 내려받은 파일은 자동 갱신되지 않습니다.
              </p>
            </details>
          </div>
        </section>
        <section
          className="desk-purpose-card book-cs"
          aria-labelledby="purpose-cs"
        >
          <header>
            <h3 id="purpose-cs">CS 이론</h3>
            <p>컴퓨터가 동작하는 원리</p>
            <BookArt kind="cs" />
          </header>
          <div className="desk-purpose-body">
            <p>질문과 해설을 읽으며 개념의 차이와 동작을 설명해 봅니다.</p>
            <ul>
              <li>
                <Link href="/questions">
                  <strong>CS 질문·해설 →</strong>
                  <span>개념을 이어 읽는 질문 지도</span>
                </Link>
              </li>
              <li>
                <Link href="/learn/engineer/concurrency">
                  <strong>동시성 개념 그림 →</strong>
                  <span>대기·잠금·교착을 비교하는 수업</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
        <section
          className="desk-purpose-card book-engineer"
          aria-labelledby="purpose-certification"
        >
          <header>
            <h3 id="purpose-certification">자격증 대비</h3>
            <p>시험별 이론과 답안 연습</p>
            <BookArt kind="engineer" />
          </header>
          <div className="desk-purpose-body">
            <p>준비하는 시험을 고르고 필요한 이론과 연습으로 이어갑니다.</p>
            <ul>
              <li>
                <Link href="/learn/certificate">
                  <strong>정보처리기사 이론 →</strong>
                  <span>DB·SQL·테스트·주소 범위 · 기출·복원 코드 제외</span>
                </Link>
              </li>
              <li>
                <Link href="/learn/engineer#questions">
                  <strong>정보관리기술사 →</strong>
                  <span>기출 찾기·답안 연습·연결 개념</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </section>
  )
}
