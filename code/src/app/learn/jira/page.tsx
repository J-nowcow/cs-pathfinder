import type { Metadata } from 'next'
import Link from 'next/link'
import missions from '../../../../learning-content/jira/missions.json'
import release from '../../../../data/pmp-release.json'
import {
  LibraryShell,
  ConceptFlow,
  libraryButton,
} from '@/components/library/LibraryShell'
import { MissionAnchor } from '@/components/library/MissionAnchor'
import { StudyPractice } from '@/components/library/StudyPractice'
export const metadata: Metadata = {
  title: 'Jira 실무 미션',
  description: '가상 작업 데이터로 요구·흐름·검색·변경·보고를 연습합니다.',
}
export default function JiraPage() {
  return (
    <LibraryShell
      eyebrow="JIRA CLOUD · PRACTICE LAB"
      title="배운 관리 개념을, 작업 한 장에."
      description="고정된 가상 BSS PI 표본으로 작업 분해·완료 증거·JQL·변경·보고를 연습합니다. 실제 Jira나 회사 데이터에 연결하지 않으며 완료 표시는 자기 점검입니다."
    >
      <MissionAnchor />
      <div className="flex flex-wrap gap-3">
        <a className={libraryButton} href="/jira/index.html">
          기존 Jira 공부방 · 10수업 →
        </a>
        <a className={libraryButton} href="/jira/index.html#practice">
          JQL20개 연습 →
        </a>
        <a className={libraryButton} href="/jira/index.html#dataset">
          가상16개 작업 →
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
        먼저 관련 수업을 읽고 표본을 확인한 뒤 미션 기록을 남기세요. 아래
        서식·예시는 창작 실습입니다. 실제 제품의 화면·요금제·권한·용어는 바뀔 수
        있으니 공부방의 공식 자료 링크와 현재 환경을 확인하세요.
        원본10수업·20JQL·16작업·60용어·33공식 링크를 보존했습니다.
      </p>
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">다섯 번의 작은 실무</h2>
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
                  Jira수업{n} →
                </a>
              ))}
              {'query' in m && (
                <a
                  className={libraryButton}
                  href={'/jira/index.html#practice/' + m.query}
                >
                  정답 집합 직접 채점 →
                </a>
              )}
              <a
                className={libraryButton}
                href={release.links.study + '#lesson/' + m.pmp}
              >
                연결된 PMP 개념 →
              </a>
              <Link
                className={libraryButton}
                href={'/learn/engineer/' + m.topic}
              >
                기술사 개념·답안 →
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
                미션의 판단 예시·확인값
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
