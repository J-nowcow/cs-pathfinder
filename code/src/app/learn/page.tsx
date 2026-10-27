import type { Metadata } from 'next'
import Link from 'next/link'
import { LearningAreas } from '@/components/LearningAreas'
import { SiteFooter } from '@/components/SiteFooter'
import { ThemeToggle } from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: '학습 도서관 · CS·PM·Jira·정보관리기술사',
  description:
    '컴퓨터과학·프로젝트·제품 관리·Jira 실무·정보관리기술사를 질문·사례·답안 연습으로 연결합니다.',
}

/** 분야 입구는 320px에서도 이동과 읽기 설정이 한 줄 안에 들어가도록 둔다. */
export default function LearningPage() {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <nav
          aria-label="학습 분야 이동"
          className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3 sm:px-8"
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[14px] font-bold text-ink"
          >
            CS 길라잡이 홈
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-4 pt-10 sm:px-8 sm:pt-16">
        <p className="text-[11px] font-medium tracking-[0.12em] text-faint">
          PATHFINDER · LEARNING AREAS
        </p>
        <h1 className="mt-4 text-[30px] font-extrabold leading-snug tracking-[-0.025em]">
          어떤 질문에서 시작할까요?
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          지금 공부할 수 있는 분야를 골라 보세요. 개념을 읽고, 사례에 적용하고,
          다시 설명하며 배웁니다.
        </p>
        <LearningAreas />
      </main>
      <SiteFooter />
    </>
  )
}
