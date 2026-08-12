'use client'

import { useState } from 'react'

/**
 * 추천 버튼.
 *
 * 게시판에 "인기" 탭이 있는데 누를 곳이 없어 upvotes가 전부 0이었다. 정렬이
 * 사실상 최신순과 같았다. 이 버튼이 그 탭을 실제로 만든다.
 *
 * 낙관적으로 먼저 바꾼다. 표 하나가 서버 왕복을 기다리는 동안 아무 반응이 없으면
 * 안 눌린 줄 알고 다시 누른다. 그러면 토글이 두 번 돌아 원래대로 돌아간다.
 * 실패하면 되돌리고 그 자리에서 말한다 — 조용히 되돌리면 눌렀다고 착각한 채 나간다.
 */
export function VoteButton({
  slug,
  initialCount,
  initialVoted,
}: {
  slug: string
  initialCount: number
  initialVoted: boolean
}) {
  const [count, setCount] = useState(initialCount)
  const [voted, setVoted] = useState(initialVoted)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    setFailed(false)

    const nextVoted = !voted
    const prevCount = count
    setVoted(nextVoted)
    setCount((c) => Math.max(0, c + (nextVoted ? 1 : -1)))

    try {
      const res = await fetch(`/api/trees/${slug}/vote`, { method: 'POST' })
      if (!res.ok) throw new Error('vote failed')
      // 서버가 진짜 숫자를 안다. 다른 사람이 그 사이에 눌렀을 수도 있다
      const body = (await res.json()) as { upvotes: number; voted: boolean }
      setCount(body.upvotes)
      setVoted(body.voted)
    } catch {
      setVoted(!nextVoted)
      setCount(prevCount)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={voted}
        aria-label={voted ? '추천 취소' : '추천'}
        aria-busy={busy || undefined}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
          voted
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line bg-raised text-muted hover:border-faint hover:text-ink'
        }`}
      >
        {/* 화살표를 쓴다. 하트는 "좋아요"로 읽혀서 취향 표시가 되는데,
            여기서 재고 싶은 것은 다른 사람이 봐도 좋을 트리인지다 */}
        <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 2.5 L12 8.5 L9.5 8.5 L9.5 12 L4.5 12 L4.5 8.5 L2 8.5 Z"
            fill={voted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        추천
        {count > 0 && <span className="font-mono text-[13px] tabular-nums">{count}</span>}
      </button>

      {failed && (
        <span role="status" className="text-[13px] text-warn">
          반영하지 못했습니다. 다시 눌러 주세요.
        </span>
      )}
    </div>
  )
}
