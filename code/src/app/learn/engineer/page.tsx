import type { Metadata } from 'next'
import Link from 'next/link'
import guides from '../../../../data/engineer-guides.json'
import index from '../../../../data/engineer-index.json'
import { LibraryShell, libraryButton } from '@/components/library/LibraryShell'
import { ExamBrowser } from '@/components/library/ExamBrowser'
export const metadata: Metadata = {
  title: '정보관리기술사 · 주제로 연결하는 기출',
  description: '24개 핵심 주제의 개념·비교·답안 연습과 60회차 기출 위치 색인.',
}
export default function EngineerPage() {
  const linked = index.questions.filter((q) => q.topics.length).length
  return (
    <LibraryShell
      eyebrow="ENGINEERING · READ / CONNECT / WRITE"
      title="기출을 모아, 주제를 이해하기."
      description="문제를 하나씩 외우기 전에 개념과 요구 유형을 연결해 보세요. 핵심24주제의 독립 설명·개념도·비교표·창작 참고 답안으로 준비하고 실제 기출에 적용합니다."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['60회차', '공식 목록에서 확인한63–140회 중 수집 회차'],
          ['1,860개', '실제 기출 위치 · 전 역사 전체 수집은 아님'],
          ['24개 주제', '창작 연습·참고 답안 · 공식 모범답안 아님'],
        ].map(([n, t]) => (
          <div key={n} className="rounded-xl border border-line bg-raised p-5">
            <b className="text-2xl">{n}</b>
            <p className="mt-2 text-sm leading-6 text-muted">{t}</p>
          </div>
        ))}
      </div>
      <details className="rounded-xl border border-line p-5">
        <summary className="cursor-pointer font-medium">
          자료 범위·원문 이용·분류 방법 확인
        </summary>
        <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
          <p>
            확인일2026-10-27. 1–62회와 공식 목록에서 찾지 못한 회차는 미확인으로
            남겼으며 미시행으로 판단하지 않습니다. 현재 수집한60회차의 각31문항
            위치가 있습니다.
          </p>
          <p>
            140회31문항만 확인된 공공누리 안내에 따라 원문을 제공합니다.
            이전1,829개는 기술명·위치 색인이며 원문 전체나 해당 기출의
            모범답안은 수록하지 않았습니다.
          </p>
          <p>
            정규화한 기술명 별칭의 정확 매칭으로 {linked}개 기록이 선정한24개
            학습 주제에 자동 연결됐고 {1860 - linked}개는 연결 대기입니다. 요구
            유형은 원문의 동사 규칙으로 추정했습니다. 배경 언급·OCR 누락이 있어
            연결 수는 동일 문제 재출제 횟수나 출제 확률이 아닙니다.
          </p>
          <p>
            주제의 연습·참고 답안·표·개념도는 자체 제작입니다. 채점 기준을 알 수
            없는 실제 시험의 공식 정답·합격 판정으로 쓰지 않습니다.
          </p>
          <a
            className="text-accent underline"
            href={index.licenseNotice}
            target="_blank"
            rel="noopener noreferrer"
          >
            Q-Net 제140회부터의 공공누리 적용 안내 ↗
          </a>
        </div>
      </details>
      <section>
        <h2 className="text-2xl font-semibold">핵심 주제의 답안 뼈대 만들기</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <Link
              key={g.id}
              href={'/learn/engineer/' + g.id}
              className="rounded-xl border border-line bg-surface p-5 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              <p className="text-xs text-faint">{g.domain}</p>
              <h3 className="mt-2 text-lg font-semibold">{g.title} →</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted">
                {g.definition}
              </p>
              <p className="mt-4 text-xs text-faint">
                자동 연결 {g.questionCount}문항 · {g.roundCount}회차 · 원문 대조
                필요
              </p>
            </Link>
          ))}
        </div>
      </section>
      <ExamBrowser
        questions={index.questions}
        topicTitles={Object.fromEntries(guides.map((g) => [g.id, g.title]))}
      />
      <Link className={libraryButton} href="/learn/progress">
        내 답안·복습 모아보기 →
      </Link>
    </LibraryShell>
  )
}
