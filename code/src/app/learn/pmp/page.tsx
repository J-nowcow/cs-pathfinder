import Link from 'next/link'
import { PmpBackup } from '@/components/pmp/PmpBackup'
import { PmpSearchForm } from '@/components/pmp/PmpSearchForm'
import { StudyDesk } from '@/components/library/StudyDesk'
import { pmpCourse as c, lessonById, pmpLessonHref } from '@/lib/pmp/course'
import release from '../../../../data/pmp-release.json'
export const metadata = { title: '프로젝트·제품 관리' }
export default function PmpHome() {
  return (
    <StudyDesk section="pmp">
      <header className="desk-document-heading">
        <p className="study-meta">PMP · 개념과 실무</p>
        <h1>
          프로젝트를 끝내고,
          <br />
          가치를 남기는 일.
        </h1>
        <p>
          목적을 정하고 계획을 세우는 순간부터, 팀과 함께 실행하고 결과를
          확인하는 과정까지 읽습니다.
        </p>
      </header>
      <div className="pmp-home-links">
        <Link href="/learn/pmp/n01">첫 수업 읽기 →</Link>
        <Link href="/learn/pmp/terms">용어 찾아보기 →</Link>
        <Link href="/learn/pmp/n44#float-lab">여유시간 실습 →</Link>
        <Link href="/learn/pmp/n35#evm-lab">성과가치 실습 →</Link>
        <Link href="/learn/pmp/n27#risk-lab">기대손실 실습 →</Link>
      </div>
      <PmpSearchForm />
      <div className="pmp-chapter-list">
        {c.tracks.map((t, i) => (
          <details key={t.id} id={t.id} className="pmp-chapter" open>
            <summary>
              <p className="study-meta">
                {String(i + 1).padStart(2, '0')} / {t.sub}
              </p>
              <h2>{t.title}</h2>
              <span className="chapter-toggle" aria-hidden="true">
                <span className="chapter-collapse">접기</span>
                <span className="chapter-expand">펼치기</span>
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </span>
            </summary>
            <ol>
              {t.order.map((id) => (
                <li key={id}>
                  <Link href={pmpLessonHref(id)}>
                    {lessonById.get(id)?.title}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
      <section className="pmp-cases">
        <h2>연결해서 생각하기</h2>
        <p>여러 개념을 하나의 가상 프로젝트에 적용해 보세요.</p>
        {c.cases.map((x) => (
          <Link key={x.id} href={'/learn/pmp/case/' + x.id}>
            {x.title} →
          </Link>
        ))}
      </section>
      <PmpBackup />
      <details className="pmp-original">
        <summary>자료 범위와 오프라인 원본</summary>
        <p>
          {c.asof} 확인본 · {c.nodes.length}수업. PMI 공식 교재나 합격·공인
          교육시간을 보장하는 과정은 아닙니다. 본문·비교표·심화 사례·상황
          문제·메모·복습·전체 기록 백업은 서재 안에서 이용합니다. 여유시간
          실습은 44번, 성과가치 실습은 35번, 기대손실 실습은 27번 수업에서
          이용할 수 있습니다. 4작업 임계 경로 실습은 이전 통합 HTML에서
          제공합니다.
        </p>
        <a href={release.links.study}>이전 통합 HTML 열기 →</a>
        <a href={release.links.offline} download>
          오프라인 ZIP 받기 ↓
        </a>
      </details>
    </StudyDesk>
  )
}
