import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GLOSSARY } from '../../../../../data/glossary'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { findGlossaryEntry, questionsForConcept } from '@/lib/glossary/questions'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ term: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { term } = await params
  const entry = findGlossaryEntry(GLOSSARY, term)
  if (!entry) return { title: '개념을 찾지 못했습니다' }
  return {
    title: `${entry.term} 면접 질문`,
    description: `${entry.term}의 뜻과 이 개념으로 준비할 CS 면접 질문을 확인합니다.`,
  }
}

export default async function ConceptPage({ params }: PageProps) {
  const { term } = await params
  const entry = findGlossaryEntry(GLOSSARY, term)
  if (!entry) notFound()

  await ensureSeeded()
  const questions = questionsForConcept(entry, await listRoots(), 5)
  const search = `/questions?q=${encodeURIComponent(entry.term)}`

  return (
    <main className="mx-auto max-w-[680px] px-5 py-10">
      <Link
        href={`/glossary#${encodeURIComponent(entry.term)}`}
        className="-my-3 inline-flex min-h-11 items-center text-[13px] text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ← 용어 사전
      </Link>

      <header className="mt-6 border-b border-line pb-6">
        <p className="text-[13px] font-medium text-accent">CS 면접 개념</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-[1.3] tracking-[-0.02em]">
          {entry.term}
          {entry.english && (
            <span className="ml-2 text-[15px] font-normal text-faint">{entry.english}</span>
          )}
        </h1>
        <p className="mt-3 text-[16px] leading-[1.75] text-muted">{entry.short}</p>
      </header>

      <section className="mt-8" aria-labelledby="concept-questions">
        <h2 id="concept-questions" className="text-[20px] font-bold tracking-[-0.01em]">
          이 개념으로 준비할 면접 질문
        </h2>
        <p className="mt-2 text-[14px] leading-[1.7] text-muted">
          용어를 외우는 데서 멈추지 않고, 설명과 설계 판단이 필요한 질문으로 이어갑니다.
        </p>

        {questions.length > 0 ? (
          <ol className="mt-5 flex list-none flex-col gap-3 p-0">
            {questions.map((question, index) => (
              <li key={question.id}>
                <Link
                  href={`/q/${question.id}`}
                  className="group block rounded-xl border border-line bg-raised p-4 no-underline transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex items-center gap-2 text-[12px] text-faint">
                    <span>{index + 1}</span>
                    <span>{question.category}</span>
                    {question.level && <span>{question.level}</span>}
                    <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                      {question.reason} 일치
                    </span>
                  </span>
                  <span className="mt-2 flex items-start gap-3 text-[15px] font-medium leading-[1.6]">
                    <span className="flex-1">{question.question}</span>
                    <span aria-hidden className="text-faint group-hover:text-accent">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-line p-5 text-[14px] text-muted">
            아직 직접 연결된 질문이 없습니다. 전체 질문에서 이 용어를 찾아볼 수 있습니다.
          </div>
        )}

        <Link
          href={search}
          className="mt-5 inline-flex min-h-11 items-center rounded-md text-[14px] font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ‘{entry.term}’ 전체 검색 결과 보기 →
        </Link>
      </section>
    </main>
  )
}
