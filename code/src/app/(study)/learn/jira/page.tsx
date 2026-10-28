import { learningMetadata } from '@/lib/seo/learning'
import { LearningSeo } from '@/components/library/LearningSeo'
import type { Metadata } from 'next'
import Link from 'next/link'
import missions from '../../../../../learning-content/jira/missions.json'
import { pmpLessonHref } from '@/lib/pmp/routes'
import {
  LibraryShell,
  ConceptFlow,
  libraryButton,
} from '@/components/library/LibraryShell'
import { MissionAnchor } from '@/components/library/MissionAnchor'
import { StudyPractice } from '@/components/library/StudyPractice'
export const metadata = learningMetadata('/learn/jira')
export default function JiraPage() {
  return (
    <LibraryShell
      eyebrow="Jira Cloud"
      title="BSS PI 작업 관리 연습"
      description="가상 작업 16개로 작업 분해, JQL 검색, 변경 기록과 보고를 연습합니다. 회사 Jira와 연결되지 않는 연습용 자료입니다."
    >
      <LearningSeo path="/learn/jira" />
      <MissionAnchor />
      <div className="flex flex-wrap gap-3">
        <a className={libraryButton} href="/jira/index.html">
          Jira 기본 수업 10개 →
        </a>
        <a className={libraryButton} href="/jira/index.html#practice">
          JQL 연습 20개 →
        </a>
        <a className={libraryButton} href="/jira/index.html#dataset">
          가상 작업 16개 보기 →
        </a>
        <a className={libraryButton} href="/jira/offline.html" download>
          Jira 오프라인 HTML ↓
        </a>
      </div>
      <ConceptFlow
        items={[
          '요구와 수용 기준',
          '상태·검색·흐름',
          '변경과 결정',
          '보고·운영·편익',
        ]}
      />
      <p className="rounded-xl border border-line bg-raised p-5 text-sm leading-7 text-muted">
        과제마다 관련 수업과 기록 양식이 있습니다. 수업을 읽고 작업 목록을
        확인한 뒤 답안을 작성하세요.
      </p>
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">연습 과제 5개</h2>
        {missions.map((m) => (
          <details
            key={m.id}
            id={m.id}
            className="scroll-mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7"
          >
            <summary className="cursor-pointer text-xl font-semibold leading-8">
              {m.title}
            </summary>
            <p className="mt-4 leading-8 text-muted">{m.goal}</p>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-7">
              {m.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <div className="my-5 flex flex-wrap gap-3">
              {m.lessons.map((n) => (
                <a
                  key={n}
                  className={libraryButton}
                  href={'/jira/index.html#lesson/' + n}
                >
                  Jira 수업 {n} →
                </a>
              ))}
              {'query' in m && (
                <a
                  className={libraryButton}
                  href={'/jira/index.html#practice/' + m.query}
                >
                  선택한 작업 키 채점 →
                </a>
              )}
              <a
                className={libraryButton}
                href={pmpLessonHref(m.pmp)}
              >
                관련 PMP 수업 →
              </a>
              <Link
                className={libraryButton}
                href={'/learn/engineer/' + m.topic}
              >
                관련 기술사 수업 →
              </Link>
            </div>
            <details className="my-5 rounded-lg border border-line p-4">
              <summary className="cursor-pointer text-sm text-accent">
                기록할 항목 펼치기
              </summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">
                {m.template}
              </pre>
            </details>
            <StudyPractice
              id={'mission:' + m.id}
              title={m.title}
              href={'/learn/jira#' + m.id}
              track="jira"
              checklist={m.checks}
            />
            <details className="mt-5 rounded-lg border border-line p-4">
              <summary className="cursor-pointer font-medium text-accent">
                예시 답안과 확인할 수치
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-7">
                {m.reference.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </div>
            </details>
          </details>
        ))}
      </section>
    </LibraryShell>
  )
}
