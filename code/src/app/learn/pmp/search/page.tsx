import Link from 'next/link'
import { StudyDesk } from '@/components/library/StudyDesk'
import { PmpSearchForm } from '@/components/pmp/PmpSearchForm'
import { searchPmpLessons } from '@/lib/pmp/search'
import { pmpLessonHref } from '@/lib/pmp/routes'

export const metadata = {
  title: 'PMP 수업 찾기',
  robots: { index: false, follow: true },
}
export default async function PmpSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { query, error, results } = searchPmpLessons((await searchParams).q)
  return (
    <StudyDesk section="pmp" document>
      <header className="desk-document-heading">
        <p className="study-meta">PMP · 다시 찾아 읽기</p>
        <h1>어느 수업에서 읽었더라?</h1>
        <p>기억나는 개념으로 수업을 찾고 앞뒤 설명을 함께 읽어보세요.</p>
      </header>
      <PmpSearchForm query={query} error={error} />
      {!error && query.trim() ? (
        <section
          className="pmp-search-results"
          aria-labelledby="pmp-result-heading"
        >
          <h2 id="pmp-result-heading">검색 결과 · {results.length}수업</h2>
          <p>
            제목에 일치하는 수업부터, 같은 순위에서는 수업 순서대로 보여줍니다.
          </p>
          {results.length ? (
            <ol>
              {results.map((result) => (
                <li key={result.id}>
                  <p className="study-meta">{result.chapter}</p>
                  <h3>
                    <Link href={pmpLessonHref(result.id)}>
                      {result.title} →
                    </Link>
                  </h3>
                  <p>{result.snippet}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              일치하는 수업이 없습니다. 단어 수를 줄이거나 다른 표현으로
              찾아보세요.
            </p>
          )}
        </section>
      ) : !error ? (
        <p>개념이나 약어를 입력해 보세요. 예: 음수 여유, CPI, 편익.</p>
      ) : null}
      <div className="pmp-home-links">
        <Link href="/learn/pmp">전체 목차 →</Link>
        <Link href="/learn/pmp/terms">용어집 →</Link>
      </div>
    </StudyDesk>
  )
}
