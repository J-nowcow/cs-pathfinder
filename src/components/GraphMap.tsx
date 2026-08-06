'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ReactFlow, Background, Controls, useReactFlow, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutGlobal, categorySummary, type Placed } from '@/lib/graph/layout'
import type { MapData, MapNode } from '@/lib/db/graph'

/**
 * 전역 질문 지도.
 *
 * 개인 여정 지도(MapModal)와는 다른 물건이다. 그쪽은 "내가 판 길"이라 트리이고
 * 깊이가 색이다. 이쪽은 "무엇이 있는지"라 카테고리가 자리이고 선은 실제로
 * 이어진 것만 긋는다.
 *
 * 프레지에서 가져온 것은 카메라뿐이다. 멀리서 보면 카테고리 덩어리만,
 * 다가가면 제목이 드러난다. 자동 투어나 회전 같은 연출은 안 넣는다 — 학습
 * 화면에서 그건 방해다.
 *
 * **해설은 노드 안에 넣지 않는다.** 300~700자를 노드에 넣으면 노드 크기가
 * 터지고 관계선도 자리 기억도 깨진다. 눌렀을 때 아래에서 시트가 올라온다.
 */

/** 제목이 읽히기 시작하는 화면상 노드 폭(px). 논리 줌 값이 아니라 실제 크기로 판단한다 */
const READABLE_WIDTH = 150

const NODE_W = 210

/** 카테고리 색. 자리와 함께 "어느 쪽인지"를 두 번 말해준다 */
const HUE: Record<string, string> = {
  데이터베이스: '#3f9d8f',
  네트워크: '#4a90b8',
  '언어 · 런타임': '#7a86c9',
  운영체제: '#a878bd',
  '자료구조 · 알고리즘': '#c26f9d',
  프레임워크: '#c47a63',
  '아키텍처 · 분산시스템': '#b09244',
  프론트엔드: '#7fa04a',
  '인프라 · 보안': '#4e9d67',
  모바일: '#5b95a8',
}

function colorOf(category: string): string {
  return HUE[category] ?? '#7d8894'
}

/**
 * 지금 배율에서 제목을 그릴지 정한다.
 *
 * 줌 값을 그대로 쓰지 않는 이유는 노드 폭이 바뀌면 같은 줌에서도 읽힘이
 * 달라지기 때문이다. 화면에 실제로 몇 px로 보이는지가 기준이다.
 */
function useShowTitles(): boolean {
  const zoom = useStore((s) => s.transform[2])
  return NODE_W * zoom >= READABLE_WIDTH
}

type Props = { data: MapData }

export function GraphMap({ data }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  const placed = useMemo(() => layoutGlobal(data.nodes), [data.nodes])
  const summary = useMemo(() => categorySummary(data.nodes), [data.nodes])
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes])

  return (
    <div className="fixed inset-0 flex flex-col bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <p className="text-[15px] font-bold">질문 지도</p>
          <p className="text-[12px] text-faint">
            질문 {data.nodes.length}개 · 이어진 선 {data.edges.length}개
          </p>
        </div>
        <Link
          href="/questions"
          className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
        >
          목록으로
        </Link>
      </header>

      <div className="relative flex-1">
        <Canvas placed={placed} summary={summary} edges={data.edges} onOpen={setOpenId} />
      </div>

      {openId && <Sheet node={byId.get(openId) ?? null} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Canvas({
  placed,
  summary,
  edges,
  onOpen,
}: {
  placed: Array<Placed<MapNode>>
  summary: ReturnType<typeof categorySummary>
  edges: MapData['edges']
  onOpen: (id: string) => void
}) {
  return (
    <ReactFlow
      nodes={[]}
      edges={[]}
      minZoom={0.06}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={44} size={1} color="var(--line)" />
      <Controls showInteractive={false} />
      <FitOnMount placed={placed} />
      <Layers placed={placed} summary={summary} edges={edges} onOpen={onOpen} />
    </ReactFlow>
  )
}

/**
 * 처음 열었을 때 전체가 들어오게 맞춘다.
 *
 * React Flow의 fitView는 자기 nodes를 기준으로 계산하는데, 여기서는 그림을
 * 직접 그리므로 React Flow가 아는 노드가 없다. 경계를 우리가 계산해서 넘긴다.
 *
 * 카테고리 이름이 노드 위쪽 330px에 서 있으므로 그만큼 위를 더 잡는다.
 * 안 그러면 이름이 화면 밖으로 잘린다.
 */
function FitOnMount({ placed }: { placed: Array<Placed<MapNode>> }) {
  const flow = useReactFlow()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || placed.length === 0) return
    done.current = true

    const pane = document.querySelector('.react-flow')
    if (!(pane instanceof HTMLElement)) return

    const xs = placed.map((p) => p.x)
    const ys = placed.map((p) => p.y)
    const minX = Math.min(...xs) - NODE_W
    const maxX = Math.max(...xs) + NODE_W
    const minY = Math.min(...ys) - 420
    const maxY = Math.max(...ys) + 120

    const zoom = Math.min(
      (pane.clientWidth * 0.94) / (maxX - minX),
      (pane.clientHeight * 0.94) / (maxY - minY),
    )
    flow.setCenter((minX + maxX) / 2, (minY + maxY) / 2, { zoom, duration: 0 })
  }, [flow, placed])

  return null
}

/**
 * 배율에 따라 무엇을 그릴지 고른다.
 *
 * React Flow의 nodes에 넣지 않고 직접 그린다. 노드가 늘어도 React Flow의
 * 내부 상태를 매번 갈아끼우지 않아도 되고, 무엇보다 배율에 따라 종류가
 * 통째로 바뀌는 그림을 표현하기 쉽다.
 */
function Layers({
  placed,
  summary,
  edges,
  onOpen,
}: {
  placed: Array<Placed<MapNode>>
  summary: ReturnType<typeof categorySummary>
  edges: MapData['edges']
  onOpen: (id: string) => void
}) {
  const showTitles = useShowTitles()
  const zoom = useStore((st) => st.transform[2])
  const flow = useReactFlow()

  /*
   * 화면상 크기를 고정한다.
   *
   * 좌표계가 통째로 축소되므로 배율의 역수를 곱한다. 17을 곱하면 배율과
   * 무관하게 화면에서 17px로 보인다.
   *
   * 처음에는 여기에 상한 56을 뒀는데 그게 문제였다. 질문이 200개가 되어
   * 전체 배율이 0.03까지 내려가자 상한에 걸려 화면에서 1.7px로 찍혔다.
   * 멀리서도 읽히게 하려던 장치가 멀리서만 안 읽히게 만든 셈이다.
   *
   * 상한은 좌표값이 터무니없어지는 것만 막는 선에서 크게 잡는다.
   */
  const labelSize = Math.min(4000, 17 / zoom)
  const labelGap = labelSize * 2.4
  const pos = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed])

  /*
   * 카테고리로 들어간다.
   *
   * 개요에서 제목이 읽히는 배율까지 가려면 휠을 열 번 넘게 굴려야 한다.
   * 그 마찰이 지도를 목록보다 못하게 만든다. 이름을 누르면 한 번에 그
   * 안으로 들어가게 한다 — 프레지에서 주제를 눌러 들어가는 것과 같다.
   */
  const enter = useCallback(
    (category: string) => {
      const mine = placed.filter((p) => p.category === category)
      if (mine.length === 0) return

      const pane = document.querySelector('.react-flow')
      const w = pane instanceof HTMLElement ? pane.clientWidth : 390
      const h = pane instanceof HTMLElement ? pane.clientHeight : 640

      // 카드 폭과 이름 높이를 여백으로 잡는다. 안 그러면 가장자리 카드가 잘린다
      const minX = Math.min(...mine.map((p) => p.x)) - NODE_W * 0.7
      const maxX = Math.max(...mine.map((p) => p.x)) + NODE_W * 0.7
      const minY = Math.min(...mine.map((p) => p.y)) - 150
      const maxY = Math.max(...mine.map((p) => p.y)) + 90

      const zoom = Math.min(
        1.2,
        Math.max(0.75, Math.min((w * 0.92) / (maxX - minX), (h * 0.92) / (maxY - minY))),
      )
      flow.setCenter((minX + maxX) / 2, (minY + maxY) / 2, { zoom, duration: 420 })
    },
    [flow, placed],
  )

  const focus = useCallback(
    (id: string) => {
      const p = pos.get(id)
      if (!p) return
      // 시트가 아래 절반을 덮으므로 남는 위쪽 가운데로 올린다
      flow.setCenter(p.x, p.y + 210, { zoom: Math.max(flow.getZoom(), 0.85), duration: 260 })
      onOpen(id)
    },
    [flow, onOpen, pos],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: 'translate(0,0)' }}
      >
        <Viewport>
          <svg className="pointer-events-none absolute overflow-visible" width={1} height={1}>
            {edges.map((e, i) => {
              const a = pos.get(e.parentId)
              const b = pos.get(e.childId)
              if (!a || !b) return null
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--line)"
                  strokeWidth={2}
                />
              )
            })}
          </svg>

          {showTitles
            ? placed.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => focus(p.id)}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-raised px-3 py-2 text-left text-[12px] leading-[1.45] shadow-sm transition-colors hover:border-accent"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: NODE_W,
                    borderColor: colorOf(p.category),
                  }}
                >
                  {p.question}
                </button>
              ))
            : placed.map((p) => (
                <span
                  key={p.id}
                  aria-hidden
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: 26,
                    height: 26,
                    background: colorOf(p.category),
                    opacity: 0.75,
                  }}
                />
              ))}

          {/*
            카테고리 이름은 배율과 무관하게 읽혀야 한다. 지도의 뼈대이고,
            멀리서 볼 때 유일하게 남는 정보다.

            좌표계가 통째로 축소되므로 글자도 같이 줄어든다. 그래서 배율의
            역수를 곱해 화면상 크기를 고정한다. 프레지에서 멀리 봐도 주제
            이름이 읽히는 것이 이 원리다.
          */}
          {summary.map((g) => (
            <button
              key={g.category}
              type="button"
              onClick={() => enter(g.category)}
              className="pointer-events-auto absolute -translate-x-1/2 text-center hover:text-accent"
              style={{ left: g.x, top: g.y - labelGap }}
            >
              <p
                className="whitespace-nowrap font-extrabold tracking-[-0.02em]"
                style={{ fontSize: labelSize, lineHeight: 1.2 }}
              >
                {g.category}
              </p>
              <p className="text-faint" style={{ fontSize: labelSize * 0.62 }}>
                {g.count}개
              </p>
            </button>
          ))}
        </Viewport>
      </div>
    </div>
  )
}

/** React Flow의 변환을 그대로 물려받아 같은 좌표계에서 그린다 */
function Viewport({ children }: { children: React.ReactNode }) {
  const transform = useStore((s) => s.transform)
  return (
    <div
      className="absolute left-0 top-0 origin-top-left"
      style={{
        transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * 해설 시트.
 *
 * 폰 390px에서 사이드패널은 지도를 다 먹고, 노드 안에 넣으면 노드가 터진다.
 * 아래에서 올라오는 시트가 읽기 폭을 확보하면서 위쪽에 지도를 남긴다.
 *
 * 제목은 즉시 띄우고 본문만 받아온다. 누른 것이 맞는지부터 보여야 기다릴 수 있다.
 */
function Sheet({ node, onClose }: { node: { id: string; question: string } | null; onClose: () => void }) {
  if (!node) return null

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 max-h-[56dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-raised shadow-2xl">
      <div className="sticky top-0 flex items-start gap-3 border-b border-line bg-raised px-5 py-4">
        <h2 className="flex-1 text-[16px] font-bold leading-[1.45]">{node.question}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-2.5 py-1 text-[13px] text-muted hover:text-ink"
        >
          닫기
        </button>
      </div>

      <div className="px-5 py-4">
        <p className="text-[14px] leading-[1.75] text-muted">
          해설은 읽기 화면에서 봅니다. 여기서는 무엇이 있는지만 보여줍니다.
        </p>
        <Link
          href={`/q/${node.id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-on-accent"
        >
          이 질문에서 파고들기 →
        </Link>
      </div>
    </div>
  )
}
