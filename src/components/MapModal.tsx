'use client'

import { useEffect, useMemo } from 'react'
import { ReactFlow, Background, Controls, Position, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cullAround, MAP_NODE_LIMIT, type Layout } from '@/lib/journey/graph'
import { depthColor } from '@/lib/journey/depth'

/**
 * 지도 모드.
 *
 * 별도 페이지가 아니라 모달이다. 읽던 자리를 잃지 않아야 한다.
 * 조망하고 원하는 노드로 점프한 뒤 읽기로 돌아오는 것이 전부다.
 */

/** 레이아웃 좌표는 미니맵 기준이라 촘촘하다. 라벨이 들어갈 만큼 벌린다 */
const SX = 1.9
const SY = 1.6
const NODE_W = 216

export function MapModal({
  layout,
  onJump,
  onClose,
}: {
  layout: Layout
  onJump: (occurrenceId: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    // 모달 뒤가 스크롤되면 닫았을 때 읽던 자리가 어긋난다.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const focus = layout.nodes.find((n) => n.isCurrent)?.occurrenceId ?? ''
  const view = useMemo(
    () => cullAround(layout, focus, MAP_NODE_LIMIT),
    [layout, focus],
  )

  const nodes: Node[] = view.nodes.map((n) => {
    const color = depthColor(n.depth)
    return {
      id: n.occurrenceId,
      position: { x: n.x * SX, y: n.y * SY },
      data: { label: n.label },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        width: NODE_W,
        padding: '9px 12px',
        borderRadius: 8,
        border: `1px solid ${n.onPath ? color : 'var(--strata-line)'}`,
        background: n.isCurrent ? color : 'var(--strata)',
        color: n.isCurrent ? '#0b0e12' : n.onPath ? 'var(--strata-ink)' : '#6d7681',
        fontSize: 13,
        lineHeight: 1.45,
        fontWeight: n.isCurrent ? 600 : 400,
        textAlign: 'left' as const,
        whiteSpace: 'normal' as const,
      },
    }
  })

  const edges: Edge[] = view.edges.map((e) => {
    const to = view.nodes.find((n) => n.occurrenceId === e.to)
    return {
      id: `${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      style: {
        stroke: e.onPath && to ? depthColor(to.depth) : 'var(--strata-line)',
        strokeWidth: e.onPath ? 2 : 1.2,
      },
    }
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="파고든 지도"
      className="fixed inset-0 z-50 flex flex-col bg-strata"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-strata-line px-5 py-3">
        <div>
          <h2 className="text-[14px] font-semibold text-white">파고든 지도</h2>
          <p className="mt-0.5 text-[12px] text-strata-ink">
            질문 {layout.nodes.length}개
            {view.hiddenCount > 0 && ` · 먼 ${view.hiddenCount}개는 숨겼어요`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-strata-line px-3 py-1.5 text-[13px] font-medium text-strata-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          닫기
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.4 }}
          // 지도는 지하 단면이라 항상 어둡다. 뷰어의 라이트/다크와 무관하게 고정한다.
          colorMode="dark"
          minZoom={0.15}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => {
            onJump(n.id)
            onClose()
          }}
        >
          <Background color="var(--strata-line)" gap={26} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
