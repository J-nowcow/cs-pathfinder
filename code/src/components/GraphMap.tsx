'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ReactFlow, Background, Controls, useReactFlow, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutGlobal, categorySummary, type Placed } from '@/lib/graph/layout'
import { analyzeConnectivity, mapStatus } from '@/lib/graph/connectivity'
import { strokeWidthAt } from '@/lib/graph/stroke'
import { rankByCategory, quotaAt, pickVisible } from '@/lib/graph/representatives'
import { fitToPane } from '@/lib/graph/fit'
import { MAP_OVERLAY_Z } from '@/lib/graph/stacking'
import { nearestGaps, hitSizeFor } from '@/lib/graph/hit'
import { wantsBrowserDefault } from '@/lib/graph/open-intent'
import { Prose } from '@/components/Prose'
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

type Props = { data: MapData }

export function GraphMap({ data }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  /*
   * 시트 안에서 이어진 질문을 눌러 옮겨왔을 때, **방금까지 보던 질문**이
   * 무엇이었는지 기억한다.
   *
   * 이어진 질문은 부모·자식을 한 목록으로 모으므로 **방금 온 질문이 늘 그
   * 안에 섞여 있다.** 표시가 없으면 사용자가 그것을 새로운 갈래로 알고 눌러
   * 왔던 곳으로 되돌아간다. 지도에서 길을 잃는 가장 흔한 방식이다.
   *
   * 지도의 점을 눌러 새로 연 것은 옮겨온 것이 아니므로 지운다.
   */
  const [cameFrom, setCameFrom] = useState<string | null>(null)

  const openFromMap = useCallback((id: string) => {
    setCameFrom(null)
    setOpenId(id)
  }, [])

  const openFromSheet = useCallback((id: string) => {
    setCameFrom(openId)
    setOpenId(id)
  }, [openId])

  const placed = useMemo(() => layoutGlobal(data.nodes), [data.nodes])
  const status = useMemo(
    () => mapStatus(analyzeConnectivity(data.nodes.map((n) => n.id), data.edges)),
    [data.nodes, data.edges],
  )
  const summary = useMemo(() => categorySummary(data.nodes), [data.nodes])
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes])

  /*
   * 노드마다 이웃을 미리 모은다.
   *
   * 선에는 방향이 있지만 시트에서는 방향을 안 따진다. "TCP를 알아야 handshake가
   * 읽힌다"의 반대편에 서 있어도 사용자가 보고 싶은 것은 이어진 질문 그 자체다.
   *
   * 시트를 열 때마다 훑으면 249개 × 선 수를 매번 돈다. 지도는 열어놓고 여러
   * 노드를 눌러보는 화면이라 그 비용이 반복된다.
   */
  const neighbors = useMemo(() => {
    const m = new Map<string, Array<{ id: string; question: string; reason?: string }>>()
    const add = (from: string, to: string, reason?: string) => {
      const node = byId.get(to)
      if (!node) return
      const list = m.get(from) ?? []
      if (list.some((l) => l.id === to)) return
      list.push({ id: to, question: node.question, reason })
      m.set(from, list)
    }
    for (const e of data.edges) {
      add(e.parentId, e.childId, e.reason)
      add(e.childId, e.parentId, e.reason)
    }
    return m
  }, [data.edges, byId])

  return (
    <div className="fixed inset-0 flex flex-col bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <p className="text-[15px] font-bold">질문 지도</p>
          <p className="text-[12px] text-faint">
            질문 {data.nodes.length}개 · 이어진 선 {data.edges.length}개
          </p>
          {/*
            선이 성긴 동안에는 그렇다고 말한다.

            잰 값으로 249개 중 54%가 아직 선이 하나도 없다. 아무 말이 없으면
            사용자는 거의 빈 화면을 보고 고장인 줄 안다. 촘촘해지면 이 줄은
            저절로 사라진다.
          */}
          {status && <p className="mt-0.5 text-[12px] text-accent">{status}</p>}
        </div>
        {/*
          지도의 유일한 출구다.

          이 화면은 `fixed inset-0`이라 사이트 헤더가 안 보인다. 그래서 여기가
          막히면 뒤로 가기 말고는 나갈 길이 없다.

          전에는 `/questions`로 보냈다. 목록은 지도와 성격이 비슷한 옆 화면이라
          "돌아간다"는 느낌이 아니었다. 홈으로 보내면 오늘의 질문과 목록·지도로
          가는 길이 다 거기 있다.
        */}
        <Link
          href="/"
          className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink"
        >
          홈으로
        </Link>
      </header>

      <div className="relative flex-1">
        <Canvas placed={placed} summary={summary} edges={data.edges} onOpen={openFromMap} />
      </div>

      {openId && (
        <Sheet
          node={byId.get(openId) ?? null}
          links={neighbors.get(openId) ?? []}
          cameFrom={cameFrom}
          onOpen={openFromSheet}
          onClose={() => {
            setCameFrom(null)
            setOpenId(null)
          }}
        />
      )}
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
      {/* 기본 Fit View는 끈다. 아는 노드가 0개라 눌러도 아무 일이 없었다 */}
      <Controls showInteractive={false} showFitView={false}>
        <FitAllButton placed={placed} />
      </Controls>
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
/**
 * 전체가 화면에 들어오게 맞춘다.
 *
 * 처음 열 때와 "전체 보기"를 누를 때가 같은 계산이라 한 곳에 둔다.
 */
function useFitAll(placed: Array<Placed<MapNode>>) {
  const flow = useReactFlow()

  return useCallback(
    (duration: number) => {
      if (placed.length === 0) return

      const pane = document.querySelector('.react-flow')
      if (!(pane instanceof HTMLElement)) return

      /*
     * 삐져나오는 것은 전부 화면 고정 크기다.
     *
     * 가장 긴 이름("아키텍처 · 분산시스템")이 139px이라 절반인 70px이 바깥으로
     * 나간다. 다만 그 이름은 무리 가운데에 서고 무리는 안쪽에 있으므로 실제로
     * 넘치는 양은 그보다 작다 — 재보니 24px였다.
     *
     * 위쪽은 배율과 무관하게 58px이다. 이름이 노드 위 41px(labelGap이 배율
     * 역수라 화면에서 늘 41px)에 서고 글자가 17px이다. 34px로 뒀더니 폰에서는
     * 안 드러났는데(가로가 배율을 정해서) 데스크톱에서 위가 잘렸다.
     *
     * 예전에는 이 자리에 좌표 고정값(가로 210, 위 420·아래 120)이 있었다.
     * 배율이 정해지기 전이라 좌표로는 얼마를 비울지 알 수 없는데 그렇게 잡으니
     * 폰에서 가로가 102%로 넘치고 세로는 46%만 찼다.
     */
      const fit = fitToPane({
        xs: placed.map((p) => p.x),
        ys: placed.map((p) => p.y),
        paneWidth: pane.clientWidth,
        paneHeight: pane.clientHeight,
        overhang: { left: 24, right: 24, top: 62, bottom: 12 },
      })
      if (!fit) return

      flow.setCenter(fit.centerX, fit.centerY, { zoom: fit.zoom, duration })
    },
    [flow, placed],
  )
}

function FitOnMount({ placed }: { placed: Array<Placed<MapNode>> }) {
  const fitAll = useFitAll(placed)
  const done = useRef(false)

  useEffect(() => {
    if (done.current || placed.length === 0) return
    done.current = true
    fitAll(0)
  }, [fitAll, placed])

  return null
}

/**
 * 전체 보기.
 *
 * React Flow가 주는 Fit View는 **아무 일도 안 했다.** 자기 `nodes`를 기준으로
 * 맞추는데 여기서는 그림을 직접 그려서 React Flow가 아는 노드가 0개다. 분야
 * 하나로 확대한 뒤 눌러도 transform이 글자 그대로 그대로였다
 * (`scale(0.194788)` → `scale(0.194788)`).
 *
 * 그래서 한 덩어리로 들어가면 전체로 돌아올 길이 없었다. 축소 버튼을 예닐곱
 * 번 누르거나 새로고침해야 했다. 버튼이 멀쩡히 있는데 안 듣는 쪽이 없는 것보다
 * 나쁘다 — 사용자는 자기가 잘못 눌렀다고 생각한다.
 */
function FitAllButton({ placed }: { placed: Array<Placed<MapNode>> }) {
  const fitAll = useFitAll(placed)
  return (
    <button
      type="button"
      className="react-flow__controls-button"
      onClick={() => fitAll(260)}
      title="전체 보기"
      aria-label="전체 보기"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden>
        <path d="M1.5 1.5h5v1.5h-3.5v3.5H1.5v-5Zm8 0h5v5H13V3h-3.5V1.5ZM1.5 9.5H3V13h3.5v1.5h-5v-5Zm11.5 0h1.5v5h-5V13H13V9.5Z" />
      </svg>
    </button>
  )
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
   * 이름을 드러낼 순위와 개수.
   *
   * 순위는 배율과 무관하게 한 번만 매긴다. 배율이 바뀔 때마다 다시 뽑으면
   * 확대하는 동안 이름이 바뀌어 어지럽고, 무엇보다 아까 본 것을 다시 못 찾는다.
   */
  const rank = useMemo(() => rankByCategory(placed, edges), [placed, edges])

  /*
   * 카드와 점도 화면상 크기를 지킨다.
   *
   * 좌표계가 축소되면 안에 있는 것이 전부 같이 줄어든다. 카테고리 이름에는 이미
   * 배율 역수 보정이 있었는데 카드와 점에는 없었다 — 그래서 폰 개요에서 점이
   * 0.82px, 확대 라벨이 9px이었다.
   *
   * 상한을 두는 이유는 배율이 0에 가까울 때 좌표가 터무니없어지는 것을 막기
   * 위해서다. 하한은 대표 카드가 개요에서도 읽히는 크기다.
   */
  const cardW = Math.min(6000, Math.max(NODE_W, 168 / zoom))
  const dotSize = Math.min(900, Math.max(6, 7 / zoom))

  /*
   * 손가락이 닿는 자리.
   *
   * 점은 작아야 개요가 지저분하지 않은데, 누르는 자리까지 작으면 못 누른다.
   * 화면상 44px를 목표로 잡는다.
   *
   * 그런데 그것만으로는 **반대쪽으로 무너진다.** 44px를 개요 배율의 좌표로
   * 옮기면 1400 단위가 넘어서, 그보다 촘촘한 자리에서는 앞 점이 뒷 점을 통째로
   * 덮는다. 보이는 A를 눌러도 B가 열렸다 — 화면 안 259개 중 자기 자신이
   * 최상단인 것이 15개뿐이었다.
   *
   * 그래서 점마다 이웃까지 거리로 상한을 따로 둔다. 자리는 배율과 무관하므로
   * 한 번만 잰다.
   */
  const wantedHit = Math.min(2400, Math.max(dotSize, 44 / zoom))
  const gaps = useMemo(() => nearestGaps(placed), [placed])

  /*
   * 실제로 이름을 띄울 것.
   *
   * 순위만으로 뽑으면 겹친다. 선이 많이 닿은 질문끼리 가까이 모여 있어서,
   * 분야 안에서 대표 3개를 띄웠더니 6쌍이 겹쳤다. 앞 카드와 겹치는 자리는
   * 건너뛰고 다음 순위가 대신 받는다.
   *
   * 문턱은 카드 폭이다. 배율이 오르면 좌표 단위 카드 폭이 줄어 문턱도 낮아지고,
   * 그만큼 더 들어간다 — 확대할수록 드러난다는 성질이 자연히 따라온다.
   */
  const visible = useMemo(
    () =>
      pickVisible(
        placed,
        rank,
        quotaAt(zoom),
        cardW * 1.08,
        // 분야 이름 자리는 비운다. 그 이름이 지도의 뼈대라 카드보다 우선한다
        summary.map((g) => ({ x: g.x, y: g.y - labelGap })),
      ),
    [placed, rank, zoom, cardW, summary, labelGap],
  )

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

      /*
       * 그 분야가 화면에 다 들어오게만 맞춘다.
       *
       * 전에는 하한 0.75가 있었다. 카드 폭이 210px로 고정이던 시절에 "이만큼은
       * 확대해야 제목이 읽힌다"고 둔 값이다. 카드가 배율을 따라가게 바뀐 뒤로는
       * 그 하한이 오히려 방해가 됐다 — 분야 하나가 1,600좌표쯤 되는데 0.75로
       * 밀어 넣으면 세 배쯤 더 들어가 가장자리 카드가 화면 밖으로 나간다.
       * 실제로 눌러보니 가운데가 텅 비고 카드가 네 귀퉁이에 걸렸다.
       *
       * 상한만 남긴다. 질문이 서넛뿐인 분야에서 지나치게 당겨지는 것만 막으면 된다.
       */
      const zoom = Math.min(1.2, Math.min((w * 0.92) / (maxX - minX), (h * 0.92) / (maxY - minY)))
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
    /*
     * `z-10`이 없으면 **점을 눌러도 아무 일이 안 일어난다.**
     *
     * React Flow의 `.react-flow__renderer`가 `z-index: 4`다. 이 겹은 그
     * 뒤에 오지만 `z-index: auto`라, DOM 순서가 뒤여도 양수 z-index를 가진
     * 형제에게 진다. 그래서 점 위에서 `elementFromPoint`가 잡는 것은 우리
     * 버튼이 아니라 `.react-flow__pane`이었다 — 클릭이 전부 팬(드래그)
     * 레이어에 먹혔다.
     *
     * 화면에는 점이 멀쩡히 보이고 커서도 바뀌니 눈으로는 멀쩡했다. 실제로
     * `elementFromPoint`를 찍어보기 전까지 안 보이는 종류다.
     *
     * 이 겹 자체는 `pointer-events-none`이라 위로 올려도 지도 드래그를
     * 막지 않는다. 통과시키고, 점과 카드만 `pointer-events-auto`로 받는다.
     */
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ zIndex: MAP_OVERLAY_Z }}
    >
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

              /*
               * 걸어간 길과 이어준 관계를 다르게 그린다.
               *
               * 걸어간 길은 사람이 실제로 지나간 것이라 확실하다. 관계는 판정이
               * 이은 것이라 틀릴 수 있다. 같은 선으로 그리면 그 차이가 사라지고,
               * 사용자는 전부 사실인 줄 안다. 관계 쪽을 점선에 옅게 둔다.
               */
              const walked = e.kind === 'walked'
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--line)"
                  strokeWidth={strokeWidthAt(zoom, walked ? 2 : 1.5)}
                  /*
                    점선 간격도 배율을 따라간다. 굵기만 고치면 축소 배율에서
                    점 하나가 0.2px 간격으로 붙어 실선처럼 보인다. 걸어간 길과
                    이어준 관계를 갈라 놓은 것이 무의미해진다.
                  */
                  strokeDasharray={walked ? undefined : `${6 / zoom} ${5 / zoom}`}
                  opacity={walked ? 1 : 0.55}
                />
              )
            })}
          </svg>

          {/*
            배율에 따라 이름을 조금씩 드러낸다.

            전에는 두 상태뿐이었다 — 멀리서는 점, 가까이서는 전부. 재보니 폰
            개요에서 점 지름이 0.82px이고 확대해도 이름이 9px이었다. 둘 다
            물리적으로 안 읽히므로 지도가 "무엇이 있는지" 알려주는 일을 아예
            못 했다.

            지금은 분야마다 대표부터 드러나고 다가갈수록 주변이 붙는다.
            순위는 고정이라 확대하는 동안 보이던 이름이 사라지지 않는다.
          */}
          {placed.map((p) => {
            const shown = visible.has(p.id)

            if (!shown) {
              /*
               * 점도 누를 수 있다.
               *
               * 전에는 `pointer-events: none`에 `aria-hidden`이라 개요에서
               * 누를 수 있는 것이 분야 이름뿐이었다. 화면의 대부분이 점인데
               * 그 전부가 죽어 있었다.
               *
               * 손가락이 닿는 크기를 따로 잡는다. 점 자체는 작아야 개요가
               * 지저분해지지 않지만, 누르는 자리는 44px는 돼야 한다.
               */
              // 이웃까지 거리로 상한을 둔다. 안 그러면 이 점이 옆 점을 삼킨다
              const hit = hitSizeFor(gaps.get(p.id) ?? Infinity, dotSize, wantedHit)

              return (
                <a
                  key={p.id}
                  href={`/q/${p.id}`}
                  aria-label={p.question}
                  onClick={(e) => {
                    if (wantsBrowserDefault(e)) return
                    e.preventDefault()
                    focus(p.id)
                  }}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center"
                  style={{ left: p.x, top: p.y, width: hit, height: hit }}
                >
                  <span
                    aria-hidden
                    className="rounded-full"
                    style={{
                      width: dotSize,
                      height: dotSize,
                      background: colorOf(p.category),
                      opacity: 0.75,
                    }}
                  />
                </a>
              )
            }

            return (
              <a
                key={p.id}
                href={`/q/${p.id}`}
                onClick={(e) => {
                  if (wantsBrowserDefault(e)) return
                  e.preventDefault()
                  focus(p.id)
                }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-raised text-left text-ink no-underline shadow-sm transition-colors hover:border-accent"
                style={{
                  left: p.x,
                  top: p.y,
                  // 카드도 글자도 화면상 크기를 지킨다. 카테고리 이름과 같은 원리다
                  width: cardW,
                  padding: `${cardW * 0.045}px ${cardW * 0.07}px`,
                  fontSize: cardW * 0.062,
                  lineHeight: 1.45,
                  borderColor: colorOf(p.category),
                }}
              >
                {p.question}
              </a>
            )
          })}

          {/*
            카테고리 이름은 배율과 무관하게 읽혀야 한다. 지도의 뼈대이고,
            멀리서 볼 때 유일하게 남는 정보다.

            좌표계가 통째로 축소되므로 글자도 같이 줄어든다. 그래서 배율의
            역수를 곱해 화면상 크기를 고정한다. 프레지에서 멀리 봐도 주제
            이름이 읽히는 것이 이 원리다.
          */}
          {summary.map((g) => (
            /*
              누르는 자리를 글자에만 준다.

              이 단추의 상자는 가장 긴 이름만큼 넓다. 개요 배율에서는 글자
              하나가 좌표 500단위를 넘어서 상자가 5,000단위가 되는데, 그
              빈 여백이 아래 점들을 통째로 덮었다 — 재보니 화면 안 249개 중
              **109개**가 이 상자에 가려 안 눌렸다.
              (`{g.count}개` 줄이 블록이라 상자 폭을 그대로 차지한다.)

              상자는 통과시키고 글자만 받는다. 클릭은 글자에서 단추로
              올라오므로 여는 동작은 그대로다.
            */
            <button
              key={g.category}
              type="button"
              onClick={() => enter(g.category)}
              className="pointer-events-none absolute -translate-x-1/2 text-center hover:text-accent"
              style={{ left: g.x, top: g.y - labelGap }}
            >
              {/* 바깥 <p>는 줄을 쌓기 위한 것이라 블록으로 두고, 받는 것은 안쪽 글자다 */}
              <p
                className="whitespace-nowrap font-extrabold tracking-[-0.02em]"
                style={{ fontSize: labelSize, lineHeight: 1.2 }}
              >
                <span className="pointer-events-auto">{g.category}</span>
              </p>
              <p className="text-faint" style={{ fontSize: labelSize * 0.62 }}>
                <span className="pointer-events-auto">{g.count}개</span>
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
export function Sheet({
  node,
  links,
  cameFrom,
  onClose,
  onOpen,
}: {
  node: { id: string; question: string } | null
  /** 이 질문과 이어진 것들. 어느 방향이든 한 목록으로 본다 */
  links: Array<{ id: string; question: string; reason?: string }>
  /** 방금까지 보던 질문. 이어진 질문 목록에 섞여 있으면 표시한다 */
  cameFrom: string | null
  onClose: () => void
  onOpen: (id: string) => void
}) {
  /*
   * 해설은 눌렀을 때 받아온다.
   *
   * 지도는 제목과 카테고리만 싣고 온다. 질문 하나에 300~700자인데 249개를 전부
   * 실어 나르면 지도를 여는 순간 수십 KB를 받게 되고, 그중 사람이 읽는 것은
   * 눌러본 한둘뿐이다.
   *
   * 받아오는 동안 제목은 이미 떠 있다. 누른 것이 맞는지부터 보여야 기다릴 수 있다.
   */
  const [body, setBody] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!node) return
    setBody(null)
    setFailed(false)

    // 받아오는 중에 다른 노드를 누르면 먼저 온 응답이 늦게 도착해 덮을 수 있다
    const ac = new AbortController()
    fetch(`/api/node/${node.id}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { body?: string }) => setBody(d.body ?? ''))
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return
        setFailed(true)
      })
    return () => ac.abort()
  }, [node?.id])

  if (!node) return null

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 max-h-[72dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-raised shadow-2xl">
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
        {/*
          해설을 여기서 읽게 한다.

          전에는 제목과 버튼만 있었다. 지도에서 질문을 눌러도 "이런 게 있다"까지만
          알 뿐 무슨 내용인지 알려면 다른 화면으로 나가야 했다. 지도를 훑는
          사람에게는 그 이동이 곧 이탈이다.
        */}
        {body === null && !failed && (
          <p className="text-[14px] leading-[1.75] text-faint">해설을 불러오는 중…</p>
        )}
        {failed && (
          <p className="text-[14px] leading-[1.75] text-muted">
            해설을 불러오지 못했습니다. 아래에서 열어 보세요.
          </p>
        )}
        {body !== null && (
          <div className="text-[14px] leading-[1.8]">
            <Prose body={body} />
          </div>
        )}

        <Link
          href={`/q/${node.id}`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-on-accent"
        >
          이 질문에서 파고들기 →
        </Link>

        {/*
          이어진 질문을 근거와 함께 보여준다.

          지도에서 선은 "이어져 있다"까지만 말한다. 왜 이어졌는지는 선을 봐서
          알 수 없고, 그것을 못 보면 사용자는 선을 믿을 근거가 없다. 판정할 때
          근거를 반드시 적게 한 이유가 여기서 쓰인다.
        */}
        {links.length > 0 && (
          <section className="mt-6">
            <h3 className="text-[12px] font-medium text-faint">이어진 질문 {links.length}개</h3>
            <ul className="mt-2 space-y-1">
              {links.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(l.id)}
                    className={
                      l.id === cameFrom
                        ? 'w-full rounded-lg border border-dashed border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent'
                        : 'w-full rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-accent'
                    }
                  >
                    {/*
                      방금 온 곳임을 말한다. 테두리만 바꾸면 색을 못 보는 사람과
                      낭독기가 못 읽으므로 글자로 적는다.
                    */}
                    {l.id === cameFrom && (
                      <span className="mb-0.5 block text-[11px] font-medium text-faint">
                        ← 방금 여기서 왔습니다
                      </span>
                    )}
                    <span className="block text-[13px] leading-[1.5]">{l.question}</span>
                    {l.reason && (
                      <span className="mt-1 block text-[12px] leading-[1.55] text-faint">{l.reason}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
