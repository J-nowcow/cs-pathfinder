import Link from 'next/link'
import type { RootSummary } from '@/lib/db/roots'

/**
 * 홈의 질문 카드.
 *
 * hero는 첫 질문 하나에만 쓴다. 전부 크게 놓으면 무엇부터 볼지가 사라진다.
 */
export function RootCard({ root, hero = false }: { root: RootSummary; hero?: boolean }) {
  return (
    <Link
      href={`/q/${root.id}`}
      className={`group block rounded-lg border border-line bg-raised transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        hero ? 'p-6 sm:p-8' : 'p-5'
      }`}
    >
      {/* 한글에 letter-spacing을 주면 글자마다 벌어져 읽기 어려워진다. 모노도 같은 이유로 피한다 */}
      <span className="text-[12px] font-medium text-faint">{root.category}</span>

      <h2
        className={`mt-2.5 font-semibold tracking-[-0.02em] text-ink group-hover:text-accent ${
          hero ? 'text-[26px] leading-[1.32] sm:text-[32px]' : 'text-[18px] leading-[1.42]'
        }`}
      >
        {root.question}
      </h2>

      <p
        className={`mt-3 text-muted ${
          hero ? 'text-[15px] leading-[1.72]' : 'line-clamp-2 text-[14px] leading-[1.65]'
        }`}
      >
        {root.excerpt}
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent">
        질문 읽기
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  )
}
