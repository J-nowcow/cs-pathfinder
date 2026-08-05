import Link from 'next/link'
import type { BoardTree } from '@/lib/db/trees'

/**
 * 게시판 카드.
 *
 * **요약을 카드의 본론으로 둔다.** 요약이 실제로 판 경로를 화살표로 이은 줄이라,
 * 이 카드가 링크 목록이 아니라 트리 목록이라는 걸 보여주는 유일한 자리다. 제목만
 * 늘어놓으면 질문 게시판과 구별되지 않는다.
 *
 * **질문 개수는 남기고 추천 수는 뺐다.** 개수는 얼마나 팠는지를 한 숫자로 말한다.
 * 추천은 아직 누를 화면이 없어서 전부 0인데, 0이 카드마다 박히면 죽은 서비스로 보인다.
 * 투표 UI가 붙는 날 같이 넣는다.
 *
 * 조회수는 세 자리부터 보여준다. "조회 1"은 정보가 아니라 아무도 안 왔다는 신호다.
 */
const VIEWS_WORTH_SHOWING = 100

export function TreeCard({ tree }: { tree: BoardTree }) {
  return (
    <Link
      href={`/t/${tree.slug}`}
      className="group block rounded-lg border border-line bg-raised p-5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-center gap-2">
        {tree.kind === 'daily' && (
          <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
            오늘의 질문
          </span>
        )}
        <span className="text-[12px] font-medium text-faint">{tree.category}</span>
      </div>

      <h3 className="mt-2.5 text-[17px] font-semibold leading-[1.42] tracking-[-0.015em] text-ink group-hover:text-accent">
        {tree.title}
      </h3>

      {tree.summary && (
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-[1.65] text-muted">{tree.summary}</p>
      )}

      <p className="mt-3.5 font-mono text-[11px] text-faint">
        질문 {tree.nodeCount}개
        {tree.views >= VIEWS_WORTH_SHOWING && <> · 조회 {tree.views}</>}
      </p>
    </Link>
  )
}

/** 로딩 자리. 설계 §7 상태 표가 게시판 로딩을 스켈레톤 카드 3장으로 잡았다 */
export function TreeCardSkeleton() {
  return (
    <div aria-hidden className="rounded-lg border border-line bg-raised p-5">
      <div className="h-3 w-16 animate-pulse rounded bg-ink/[0.07]" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-ink/[0.07]" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-ink/[0.06]" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-ink/[0.06]" />
    </div>
  )
}
