import { notFound } from 'next/navigation'
import Link from 'next/link'
import guides from '../../../../../data/engineer-guides.json'
import index from '../../../../../data/engineer-index.json'
import {
  LibraryShell,
  ConceptFlow,
  libraryButton,
} from '@/components/library/LibraryShell'
import { StudyPractice } from '@/components/library/StudyPractice'
import { ExamBrowser } from '@/components/library/ExamBrowser'
export function generateStaticParams() {
  return guides.map((g) => ({ topic: g.id }))
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>
}) {
  const { topic } = await params
  return { title: guides.find((g) => g.id === topic)?.title ?? '학습 주제' }
}
export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>
}) {
  const { topic } = await params
  const g = guides.find((g) => g.id === topic)
  if (!g) notFound()
  return (
    <LibraryShell
      reading
      eyebrow={g.domain + ' · 정보관리기술사'}
      title={g.title}
      description={g.definition}
    >
      <ConceptFlow items={g.flow} />
      <section>
        <h2 className="text-2xl font-semibold">비슷해도 다른 개념</h2>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm leading-7">
            <thead className="bg-raised">
              <tr>
                {['개념', '의미·목적', '구분할 점'].map((t) => (
                  <th scope="col" key={t} className="min-w-28 p-4">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.comparison.map((row) => (
                <tr key={row[0]} className="border-t border-line">
                  {row.map((v, i) =>
                    i === 0 ? (
                      <th scope="row" key={i} className="p-4 font-medium">
                        {v}
                      </th>
                    ) : (
                      <td key={i} className="p-4 align-top">
                        {v}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-xl border border-line bg-raised p-6">
        <p className="text-xs text-faint">직접 만든 연습 문제</p>
        <h2 className="mt-3 text-xl font-semibold leading-8">{g.prompt}</h2>
        <h3 className="mt-6 font-semibold">답안 구성</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7">
          {g.outline.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </section>
      <StudyPractice
        id={'topic:' + g.id}
        title={g.title}
        href={'/learn/engineer/' + g.id}
        track="engineer"
        visit
        checklist={g.outline.map((x) => x + '를 답안에 설명했다')}
      />
      <details className="rounded-xl border border-line bg-surface p-6">
        <summary className="cursor-pointer text-lg font-semibold text-accent">
          참고 답안 보기
        </summary>
        <div className="mt-5 space-y-4 text-base leading-8">
          {g.reference.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
        <p className="mt-5 text-xs leading-6 text-faint">
          이 연습 문제의 학습용 참고 답안입니다. 공식 기출 해설이나 채점 기준은
          아닙니다.
        </p>
      </details>
      <aside className="rounded-xl border border-line p-6">
        <h2 className="text-xl font-semibold">자주 틀리는 부분</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7">
          {g.pitfalls.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </aside>
      <section>
        <h2 className="text-xl font-semibold">참고 자료</h2>
        {g.sources.map((s) => (
          <div key={s.url} className="mt-4 text-sm leading-7">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4"
            >
              {s.title} ↗
            </a>
            <p className="text-faint">
              확인 {s.checked} · {s.scope}
            </p>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap gap-3">
        {g.related.map((id) => (
          <Link
            key={id}
            className={libraryButton}
            href={'/learn/engineer/' + id}
          >
            {guides.find((x) => x.id === id)?.title} →
          </Link>
        ))}
        <Link className={libraryButton} href="/learn/engineer">
          전체 주제
        </Link>
      </div>
      <ExamBrowser
        questions={index.questions.filter(
          (q) =>
            q.topics.includes(g.id) ||
            q.backgroundTopics.some((id) => id === g.id),
        )}
        topicTitles={Object.fromEntries(guides.map((x) => [x.id, x.title]))}
      />
    </LibraryShell>
  )
}
