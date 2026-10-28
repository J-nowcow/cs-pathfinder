import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConceptSteps } from '@/components/library/ConceptSteps'
import { LibraryShell } from '@/components/library/LibraryShell'
import { PmpPractice } from '@/components/pmp/PmpPractice'
import { PmpFloatLab } from '@/components/pmp/PmpFloatLab'
import { PmpEvmLab } from '@/components/pmp/PmpEvmLab'
import { PmpRiskLab } from '@/components/pmp/PmpRiskLab'
import {
  pmpCourse as c,
  lessonById,
  pmpOrder,
  pmpLessonHref,
  nativePmpHtml,
} from '@/lib/pmp/course'
export function generateStaticParams() {
  return c.nodes.map((n) => ({ lesson: n.id }))
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lesson: string }>
}) {
  const { lesson } = await params
  return { title: lessonById.get(lesson)?.title ?? 'PMP 수업' }
}
export default async function PmpLesson({
  params,
}: {
  params: Promise<{ lesson: string }>
}) {
  const { lesson } = await params,
    n = lessonById.get(lesson)
  if (!n) notFound()
  const t = c.tracks.find((x) => x.id === n.track)!,
    at = pmpOrder.indexOf(n.id),
    sources = c.sources.filter((s) => n.sources.includes(s.id))
  return (
    <LibraryShell
      reading
      eyebrow={'PMP · ' + t.title}
      title={n.title}
      description={n.q}
    >
      <article className="pmp-lesson">
        <p className="pmp-answer-lead">{n.answer}</p>
        <div className="pmp-body">
          {n.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {!!n.steps.length && (
          <section>
            <h2>생각을 정리하는 순서</h2>
            <ConceptSteps steps={n.steps} />
          </section>
        )}
        {'table' in n && n.table?.length ? (
          <section>
            <h2>비교해서 이해하기</h2>
            <div className="pmp-table-scroll">
              <table>
                <thead>
                  <tr>
                    {['개념', '설명', '확인할 점'].map((x) => (
                      <th scope="col" key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {n.table.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) =>
                        j === 0 ? (
                          <th key={j} scope="row">
                            {v}
                          </th>
                        ) : (
                          <td key={j}>{v}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {'worked' in n && n.worked?.length ? (
          <section>
            <h2>예제로 따라가기</h2>
            {n.worked.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </section>
        ) : null}
        {'trap' in n && n.trap ? (
          <aside className="story-margin-note">
            <strong>혼동하기 쉬운 부분</strong>
            <p>{n.trap}</p>
          </aside>
        ) : null}
        {'supplement' in n && n.supplement ? (
          <div
            className="pmp-supplement"
            dangerouslySetInnerHTML={{ __html: nativePmpHtml(n.supplement) }}
          />
        ) : null}
        {'lab' in n && n.lab === 'float' ? (
          <PmpFloatLab
            config={c.floatLab}
            source={c.sources.find((s) => s.id === 'cpm')!}
          />
        ) : null}
        {n.id === 'n35' ? <PmpEvmLab /> : null}
        {n.id === 'n27' ? <PmpRiskLab /> : null}
        <PmpPractice key={n.id} id={n.id} visit />
        <section>
          <h2>이 수업의 용어</h2>
          <dl className="pmp-terms-inline">
            {n.terms.map((term) => {
              const found = c.glossary.find(
                (g) => g.en === term || g.ko === term,
              )
              return (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>
                    {found?.body ?? '전체 용어집에서 관련 표현을 찾아보세요.'}
                  </dd>
                </div>
              )
            })}
          </dl>
          <Link href="/learn/pmp/terms">전체 용어집 →</Link>
        </section>
        <section>
          <h2>참고한 자료</h2>
          {sources.map((s) => (
            <div key={s.id} className="pmp-source">
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title} ↗
              </a>
              <p className="study-meta">{s.note}</p>
            </div>
          ))}
        </section>
        <section>
          <h2>함께 읽을 수업</h2>
          <div className="pmp-related">
            {n.links
              .filter((id) => lessonById.has(id))
              .map((id) => (
                <Link key={id} href={pmpLessonHref(id)}>
                  {lessonById.get(id)!.title} →
                </Link>
              ))}
          </div>
        </section>
      </article>
      <nav className="pmp-lesson-nav" aria-label="PMP 수업 순서">
        {at > 0 ? (
          <Link href={pmpLessonHref(pmpOrder[at - 1])}>
            ← {lessonById.get(pmpOrder[at - 1])!.title}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/learn/pmp">목차</Link>
        {at < pmpOrder.length - 1 ? (
          <Link href={pmpLessonHref(pmpOrder[at + 1])}>
            {lessonById.get(pmpOrder[at + 1])!.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </LibraryShell>
  )
}
