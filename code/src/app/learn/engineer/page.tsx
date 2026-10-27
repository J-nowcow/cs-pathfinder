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
  const reviewed = index.questions.filter((q) => q.classification).length
  const candidates = index.questions.filter(
    (q) => !q.classification && q.topics.length,
  ).length
  const backgroundOnly = index.questions.filter(
    (q) => !q.topics.length && q.backgroundTopics.length,
  ).length
  return (
    <LibraryShell
      eyebrow="정보관리기술사"
      title="개념 공부와 기출 연습"
      description="24개 주제의 개념과 참고 답안을 읽고, 회차별 기출을 찾아 답안을 연습합니다."
    >
      <nav
        aria-label="기술사 학습 시작"
        className="study-jump-nav flex flex-wrap gap-6 border-b border-line pb-5"
      >
        <a
          href="#topics"
          className="min-h-11 content-center text-accent underline underline-offset-8"
        >
          <strong className="text-lg">개념부터 공부하기 ↓</strong>
        </a>
        <a
          href="#questions"
          className="min-h-11 content-center text-accent underline underline-offset-8"
        >
          <strong className="text-lg">기출부터 찾아보기 ↓</strong>
        </a>
      </nav>
      <p className="study-meta text-muted">
        개념 수업 24개 · 수집한 60회차의 기출 색인 1,860개 · 원문 제공 31문항
      </p>
      <section id="topics" className="scroll-mt-8">
        <h2 className="text-2xl font-semibold">분야별 개념 공부</h2>
        <p className="study-measure mt-3 text-muted">
          분야를 펼치면 수업을 고를 수 있습니다.
        </p>
        <div className="mt-6 space-y-4">
          {[...new Set(guides.map((g) => g.domain))].map((domain) => (
            <details
              key={domain}
              className="rounded-xl border border-line bg-raised p-6"
            >
              <summary className="cursor-pointer font-semibold">
                {domain}{' '}
                <span className="ml-3 font-normal text-muted">
                  {guides.filter((g) => g.domain === domain).length}개 주제
                </span>
              </summary>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {guides
                  .filter((g) => g.domain === domain)
                  .map((g) => (
                    <Link
                      key={g.id}
                      href={'/learn/engineer/' + g.id}
                      className="rounded-xl border border-line bg-surface p-5 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <h3 className="mt-2 text-lg font-semibold">
                        {g.title} →
                      </h3>
                      <p className="mt-3 text-muted">{g.definition}</p>
                      <p className="study-meta mt-4 text-faint">
                        핵심 이해 {g.reviewedCount} · 자동 후보{' '}
                        {g.candidateCount} · 보충 {g.backgroundCount}문항
                      </p>
                    </Link>
                  ))}
              </div>
            </details>
          ))}
        </div>
      </section>
      <ExamBrowser
        questions={index.questions}
        topicTitles={Object.fromEntries(guides.map((g) => [g.id, g.title]))}
      />
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
            {reviewed}문항은 원문의 요구 항목과 문맥을 대조해 편집 분류했습니다.
            {candidates}문항의 수업 연결은 기술명 별칭 매칭에 따른 자동
            후보입니다. 핵심 이해 또는 자동 후보 연결은 {linked}문항, 보충
            수업만 연결된 기록은 {backgroundOnly}문항이며 나머지{' '}
            {index.questions.length - linked - backgroundOnly}문항은 수업 연결
            대기입니다. 미검토 문항의 요구 유형은 동사 규칙으로 추정했습니다.
            배경 언급·OCR 누락이 있어 연결 수는 동일 문제 재출제 횟수나 출제
            확률이 아닙니다.
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
      <details
        className="rounded-xl border border-line bg-raised p-6"
        aria-labelledby="classification-guide"
      >
        <summary
          id="classification-guide"
          className="cursor-pointer font-semibold"
        >
          문제 읽는 법 · 핵심과 배경 구분하기
        </summary>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            [
              '01 · 핵심 주제',
              '답안에서 직접 설명해야 할 대상을 찾습니다. 통계의 ‘분산’은 분산 시스템과 구분합니다.',
            ],
            [
              '02 · 배경·맥락',
              'AI·클라우드가 등장해도 스토리지 비교가 중심일 수 있습니다. 보충 수업은 핵심 출제 주제와 따로 표시합니다.',
            ],
            [
              '03 · 답안 요구',
              '정의·비교·절차·적용을 함께 요구하면 각각 답안 항목으로 만듭니다. 기술명만 있는 단문형의 해석도 표시합니다.',
            ],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 border-t border-line pt-4 text-sm leading-7 text-muted">
          검토 범위: 140회 {reviewed}문항 원문 대조 · 나머지{' '}
          {index.questions.length - reviewed}문항 자동 후보. 편집 분류는 공식
          출제 분류·채점 기준·전문가 감수가 아닙니다. 아래 ‘분류 상태’에서
          구분해 볼 수 있습니다.
        </p>
      </details>
      <Link className={libraryButton} href="/learn/progress">
        내 답안·복습 모아보기 →
      </Link>
    </LibraryShell>
  )
}
