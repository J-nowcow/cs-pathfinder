import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LibraryShell, ConceptFlow } from '@/components/library/LibraryShell'
import { CertificateTable } from '@/components/certificate/CertificateTable'
import { CertificatePractice } from '@/components/certificate/CertificatePractice'
import { CertificateCidrFigure } from '@/components/certificate/CertificateCidrFigure'
import { CertificateCoverageGraph } from '@/components/certificate/CertificateCoverageGraph'
import {
  certificate as c,
  certificateLessons,
  certificateHref,
  certificateDomain,
} from '@/lib/certificate/course'
export function generateStaticParams() {
  return c.lessons.map((n) => ({ lesson: n.id }))
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lesson: string }>
}) {
  const { lesson } = await params
  return { title: certificateLessons.get(lesson)?.title ?? '정보처리기사 이론' }
}
export default async function CertificateLesson({
  params,
}: {
  params: Promise<{ lesson: string }>
}) {
  const { lesson } = await params,
    n = certificateLessons.get(lesson)
  if (!n) notFound()
  const at = c.lessons.findIndex((x) => x.id === n.id)
  return (
    <LibraryShell
      reading
      eyebrow={
        '정보처리기사 · ' +
        certificateDomain(n) +
        ' · ' +
        String(at + 1).padStart(2, '0') +
        '/' +
        c.lessons.length
      }
      title={n.title}
      description={n.question}
    >
      <article className="pmp-lesson certificate-lesson">
        <p className="pmp-answer-lead">{n.lead}</p>
        <div className="pmp-body">
          {n.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <ConceptFlow items={n.flow} />
        {n.id === 'test-coverage' ? <CertificateCoverageGraph /> : null}
        {n.id === 'ipv4-subnet' ? <CertificateCidrFigure /> : null}
        <section>
          <h2>같은 상황에서 비교하기</h2>
          <CertificateTable
            caption="개념의 기준과 확인할 점"
            headers={['개념', '기준', '확인할 점']}
            rows={n.comparison}
          />
        </section>
        <section>
          <h2>도서관 예제로 따라가기</h2>
          {n.example.code && (
            <pre className="certificate-code">
              <code>{n.example.code}</code>
            </pre>
          )}
          {n.example.rows && n.example.headers && (
            <CertificateTable
              caption={
                n.example.verification ??
                '예상 결과 · 격리된 PGlite 실행으로 확인'
              }
              headers={n.example.headers}
              rows={n.example.rows}
            />
          )}
          <p>{n.example.text}</p>
          {n.domain === 'db-sql' ? (
            <details>
              <summary>공통 예제 데이터 보기</summary>
              <CertificateTable caption="books" {...c.books} />
              <CertificateTable caption="loans" {...c.loans} />
            </details>
          ) : null}
        </section>
        <aside className="certificate-caution">
          <h2>함께 기억할 조건</h2>
          <p>{n.trap}</p>
        </aside>
        <CertificatePractice key={n.id} id={n.id} />
        <section>
          <h2>참고한 자료</h2>
          {c.sources
            .filter((s) => n.sources.includes(s.id))
            .map((s) => (
              <div className="certificate-source" key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title} ↗
                </a>
                <p className="study-meta">
                  {s.edition} · 확인 {s.checked}
                </p>
              </div>
            ))}
          <details>
            <summary>이전 개념 자료와의 연결</summary>
            <p>이전 자료에서 다룬 주제를 이어받아 설명과 예시를 다시 썼어요.</p>
            <ul>
              {c.origin.concepts
                .filter((x) => n.originConceptIds.includes(x.id))
                .map((x) => (
                  <li key={x.id}>
                    {x.title}
                    <ul>
                      {x.sources.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.title} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          </details>
        </section>
        <nav className="pmp-lesson-nav" aria-label="이론 수업 이동">
          {at > 0 ? (
            <Link href={certificateHref(c.lessons[at - 1].id)}>
              ← {c.lessons[at - 1].title}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/learn/certificate">목차·백업</Link>
          {at < c.lessons.length - 1 && (
            <Link href={certificateHref(c.lessons[at + 1].id)}>
              {c.lessons[at + 1].title} →
            </Link>
          )}
        </nav>
      </article>
    </LibraryShell>
  )
}
