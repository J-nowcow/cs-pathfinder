'use client'

import { useEffect, useRef } from 'react'
import type { Layout } from '@/lib/journey/graph'
import { COL_W, ROW_H } from '@/lib/journey/graph'
import { depthColor } from '@/lib/journey/depth'

/**
 * 하단에 상시 고정하는 지층 단면.
 *
 * 이게 통증 해결의 핵심이다. 포커스 뷰만 있으면 결국 선형이라 카톡과
 * 구조적으로 같은 계열이 된다. 관계가 보인다는 것이 매 화면에서 체감되어야 한다.
 *
 * 접거나 숨기는 옵션을 두지 않는다. 숨길 수 있으면 대부분 숨기고,
 * 그러면 이 서비스는 다시 선형이 된다.
 */

/** 지도 모드의 좌표를 스트립 크기로 압축한다 */
const SX = 40 / COL_W
const SY = 17 / ROW_H
const PAD = 14
const MIN_H = 58

export function MinimapStrip({
  layout,
  justAddedId,
  onJump,
  onOpenMap,
}: {
  layout: Layout
  justAddedId: string | null
  onJump: (occurrenceId: string) => void
  onOpenMap: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)

  const current = layout.nodes.find((n) => n.isCurrent)
  const currentX = current ? current.x * SX + PAD : 0

  // 현재 위치를 가운데로 끌어온다. 깊이가 쌓이면 오른쪽 끝으로 밀려 보이지 않는다.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ left: Math.max(0, currentX - el.clientWidth / 2), behavior: 'smooth' })
  }, [currentX])

  const width = Math.max(layout.bounds.width * SX + PAD * 2, 1)
  const height = Math.max(layout.bounds.height * SY + PAD * 2, MIN_H)

  const pos = (x: number, y: number) => ({ cx: x * SX + PAD, cy: y * SY + PAD })

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-strata-line bg-strata">
      <div className="mx-auto flex max-w-3xl items-stretch">
        <div ref={scroller} className="scroll-x min-w-0 flex-1 py-1">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`내 질문 지도. 질문 ${layout.nodes.length}개`}
            className="block"
          >
            {layout.edges.map((e) => {
              const from = layout.nodes.find((n) => n.occurrenceId === e.from)
              const to = layout.nodes.find((n) => n.occurrenceId === e.to)
              if (!from || !to) return null

              const a = pos(from.x, from.y)
              const b = pos(to.x, to.y)
              const mid = (a.cx + b.cx) / 2

              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M ${a.cx} ${a.cy} C ${mid} ${a.cy}, ${mid} ${b.cy}, ${b.cx} ${b.cy}`}
                  fill="none"
                  stroke={e.onPath ? depthColor(to.depth) : 'var(--strata-line)'}
                  strokeWidth={e.onPath ? 1.6 : 1}
                  opacity={e.onPath ? 0.85 : 1}
                />
              )
            })}

            {layout.nodes.map((n) => {
              const { cx, cy } = pos(n.x, n.y)
              const color = depthColor(n.depth)

              return (
                <g key={n.occurrenceId}>
                  {n.isCurrent && (
                    <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.22}>
                      {/* 확장 직후 새 노드가 붙는 것을 잠깐 보여준다 */}
                      {justAddedId === n.occurrenceId && (
                        <animate
                          attributeName="r"
                          values="4;13;8"
                          dur="0.7s"
                          repeatCount="1"
                          fill="freeze"
                        />
                      )}
                    </circle>
                  )}

                  <circle
                    cx={cx}
                    cy={cy}
                    r={n.isCurrent ? 4.5 : n.onPath ? 3.5 : 2.8}
                    fill={n.onPath || n.isCurrent ? color : 'var(--strata-line)'}
                    stroke={n.isCurrent ? 'var(--strata)' : 'none'}
                    strokeWidth={1.5}
                  />

                  {/* 히트 영역을 넉넉히 준다. 점 자체는 손가락으로 누르기엔 너무 작다 */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={11}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.label}로 이동`}
                    aria-current={n.isCurrent ? 'location' : undefined}
                    className="cursor-pointer focus-visible:stroke-accent focus-visible:stroke-2 focus-visible:outline-none"
                    onClick={() => onJump(n.occurrenceId)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      onJump(n.occurrenceId)
                    }}
                  >
                    <title>{n.label}</title>
                  </circle>
                </g>
              )
            })}
          </svg>
        </div>

        <button
          type="button"
          onClick={onOpenMap}
          className="flex shrink-0 items-center gap-1.5 border-l border-strata-line px-4 text-[12px] font-medium text-strata-ink transition-colors hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          내 질문 지도
          <span aria-hidden className="font-mono text-[11px] opacity-70">
            {layout.nodes.length}
          </span>
        </button>
      </div>
    </div>
  )
}
