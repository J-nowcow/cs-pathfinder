'use client'

import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
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

/** 이보다 줄이면 라벨을 못 읽는다. 다 안 보이면 밀어서 보면 된다 */
const MIN_READABLE_ZOOM = 0.7


/**
 * 지금 서 있는 자리를 화면 가운데 놓는다.
 *
 * fitView는 그래프 전체를 넣으려 한다. 여정은 깊이 방향으로 퍼지는데 폰은
 * 세로로 길어서, 390px 화면에서는 0.25배까지 줄어 글자를 못 읽었다.
 * 최소 배율로 바닥을 깔면 읽히지만 이번엔 현재 위치가 화면 밖으로 밀린다.
 * 지도를 열었는데 내가 어디 있는지 안 보이면 열 이유가 없다.
 *
 * fitViewOptions.nodes로 경로만 맞추는 방법을 먼저 시도했는데 먹지 않았다 —
 * 실측하니 선언형이든 명령형이든 전체 기준으로 맞춰졌다. 그래서 좌표를 직접
 * 계산해 가운데로 옮긴다. 이쪽은 어긋날 여지가 없다.
 *
 * 배율은 fitView가 정한 값을 쓰되 읽을 수 있는 선까지만 줄인다. 넓은 화면에서
 * 그래프가 작으면 예전처럼 전체가 보이고, 좁은 화면에서는 현재 자리 주변이 보인다.
 */
function FocusHere({ id }: { id: string }) {
  const flow = useReactFlow()

  useEffect(() => {
    if (!id) return

    const center = () => {
      const pane = document.querySelector('.react-flow')
      if (!(pane instanceof HTMLElement)) return

      /*
       * 전체가 읽을 수 있는 크기로 들어가면 그대로 둔다.
       *
       * 넓은 화면에서 그래프가 작으면 fitView가 이미 잘 맞춘다. 그때까지
       * 현재 노드를 가운데로 끌어오면 뿌리에 서 있을 때 화면 절반이 빈다.
       *
       * 안 들어갈 때만 현재 자리로 옮긴다. 폰에서 전체를 넣으려다 0.25배까지
       * 줄어 글자를 못 읽던 경우가 여기 해당한다.
       */
      const bounds = flow.getNodesBounds(flow.getNodes())
      const fits =
        bounds.width * MIN_READABLE_ZOOM <= pane.clientWidth * 0.92 &&
        bounds.height * MIN_READABLE_ZOOM <= pane.clientHeight * 0.92
      if (fits) return

      const node = flow.getNode(id)
      if (!node) return
      const w = node.measured?.width ?? NODE_W
      const h = node.measured?.height ?? 56
      flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: MIN_READABLE_ZOOM,
        duration: 0,
      })
    }

    /*
     * 두 번 옮긴다.
     *
     * fitView는 노드 크기가 잡힌 뒤에 한 번 더 도는데, 그 시점이 브라우저마다
     * 다르다. useNodesInitialized로 기다려봤지만 헤드리스에서는 끝내 참이 되지
     * 않았다. 그 신호에 매달리는 대신 fitView가 끝났을 만한 두 시점에 덮어쓴다.
     *
     * 옮기는 연산은 싸고 결과가 같아서 두 번 해도 눈에 띄지 않는다.
     */
    const raf = requestAnimationFrame(center)
    const later = setTimeout(center, 180)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(later)
    }
  }, [flow, id])

  return null
}

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
      aria-label="내 질문 지도"
      className="fixed inset-0 z-50 flex flex-col bg-strata"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-strata-line px-5 py-3">
        <div>
          <h2 className="text-[14px] font-semibold text-white">내 질문 지도</h2>
          <p className="mt-0.5 text-[12px] text-strata-ink">
            질문 {layout.nodes.length}개
            {view.hiddenCount > 0 && ` · 멀리 있는 질문 ${view.hiddenCount}개는 숨겼습니다`}
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
          /*
           * 축소에 바닥을 깐다.
           *
           * 여정은 깊이 방향으로 넓게 퍼지는데, 폰은 세로로 길다. 바닥이 없으면
           * fitView가 0.25배까지 줄여 전부 화면에 넣고, 그러면 글자를 못 읽는다.
           * 실제로 390px 화면에서 그렇게 나왔다.
           *
           * 다 안 보이면 밀어서 보면 된다. 다 보이는데 못 읽는 것보다 낫다.
           * 레이아웃 자체를 세로로 눕히는 편이 더 나은 답이지만, 그 좌표를
           * 미니맵과 공유하고 있어 여기서만 바꿀 수 없다.
           */
          fitViewOptions={{ padding: 0.18, minZoom: 0.7, maxZoom: 1.4 }}
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
          <FocusHere id={focus} />
          <Background color="var(--strata-line)" gap={26} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
