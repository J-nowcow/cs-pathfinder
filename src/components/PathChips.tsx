'use client'

import { useEffect, useRef } from 'react'
import { depthColor } from '@/lib/journey/depth'
import type { Occurrence } from '@/lib/journey/types'

/**
 * 깊이를 표현하는 상단 경로.
 *
 * 들여쓰기 트리를 쓰지 않는 이유가 여기 있다. 무한 확장이 전제라 깊이 5단이면
 * 질문 한 줄이 세로로 접힌다. 깊이는 이 칩 줄이 대신 표현한다.
 *
 * 칩 자체도 무한히 늘어날 수 없어 가운데를 접는다. 뿌리와 최근 몇 걸음이
 * 방향을 잡는 데 필요한 전부다.
 */
const HEAD = 1
const TAIL = 3

export function PathChips({
  path,
  onJump,
}: {
  path: Occurrence[]
  onJump: (occurrenceId: string) => void
}) {
  const scroller = useRef<HTMLElement>(null)
  const currentId = path.length > 0 ? path[path.length - 1].id : null

  // 현재 칩은 줄 끝에 있다. 깊이가 쌓이면 화면 밖으로 밀려 어디 있는지 안 보인다.
  // rAF로 미룬다. effect 시점에는 새 칩이 아직 레이아웃되지 않아 scrollWidth가 옛값이다.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = scroller.current
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [currentId])

  if (path.length === 0) return null

  const folded = path.length > HEAD + TAIL + 1
  const shown = folded
    ? [...path.slice(0, HEAD), null, ...path.slice(-TAIL)]
    : path

  return (
    <nav ref={scroller} aria-label="파고든 경로" className="scroll-x -mx-5 sm:-mx-8">
      {/* 패딩은 ol에 준다. nav에 주면 스크롤 끝에서 오른쪽 여백이 사라져 현재 칩이 잘린다 */}
      <ol className="flex w-max items-center gap-1.5 px-5 sm:px-8">
        {shown.map((occ, i) => {
          if (occ === null) {
            return (
              <li key="fold" aria-hidden className="px-1 text-[13px] text-faint">
                ⋯
              </li>
            )
          }

          const depth = folded && i > HEAD ? path.length - (shown.length - i) : i
          const isLast = i === shown.length - 1

          return (
            <li key={occ.id} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-[11px] text-faint">
                  ›
                </span>
              )}
              <button
                type="button"
                onClick={() => onJump(occ.id)}
                aria-current={isLast ? 'step' : undefined}
                className={`flex max-w-[13rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isLast
                    ? 'border-transparent bg-ink/[0.06] font-medium text-ink'
                    : 'border-line text-muted hover:border-faint hover:text-ink'
                }`}
              >
                <span
                  aria-hidden
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ background: depthColor(depth) }}
                />
                <span className="truncate">{occ.question}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
