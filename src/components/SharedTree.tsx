import Link from 'next/link'
import { layoutJourney, COL_W, ROW_H } from '@/lib/journey/graph'
import { depthColor } from '@/lib/journey/depth'
import type { TreeNode } from '@/lib/db/trees'

/**
 * 박제된 트리를 그린다.
 *
 * 클라이언트 코드가 한 줄도 없다. 공유 링크로 들어온 사람은 대부분 카톡에서
 * 처음 오는 사람이라 첫 화면이 빨라야 하고, 여기엔 상태가 없다.
 *
 * 좌표는 읽기 뷰의 `layoutJourney`를 그대로 쓴다. 계산을 두 벌로 두면 같은 트리가
 * 내 화면과 공유 화면에서 다르게 보인다.
 */

/** 지도 좌표를 카드 크기로 압축한다. 미니맵과 같은 방식이다 */
const SX = 46 / COL_W
const SY = 22 / ROW_H
const PAD = 16

type Props = { nodes: TreeNode[] }

function toJourney(nodes: TreeNode[]) {
  return {
    occurrences: nodes.map((n) => ({
      id: n.occurrenceId,
      nodeId: n.nodeId,
      parentId: n.parentOccurrenceId,
      question: n.question,
      category: n.category,
    })),
    // 공유 트리에는 "지금 읽는 자리"가 없다. 전부 지나간 길이라 하나만 강조할 이유가 없다
    currentId: null,
  }
}

/** 한눈에 모양을 보여주는 단면 */
function TreeShape({ nodes }: Props) {
  const layout = layoutJourney(toJourney(nodes))
  if (layout.nodes.length < 2) return null

  const width = layout.bounds.width * SX + PAD * 2
  const height = layout.bounds.height * SY + PAD * 2
  const pos = (x: number, y: number) => ({ cx: x * SX + PAD, cy: y * SY + PAD })

  return (
    <div className="scroll-x -mx-5 rounded-lg border border-strata-line bg-strata px-5 py-3 sm:mx-0">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`파고든 모양. 질문 ${layout.nodes.length}개`}
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
              stroke={depthColor(to.depth)}
              strokeWidth={1.4}
              opacity={0.7}
            />
          )
        })}

        {layout.nodes.map((n) => {
          const { cx, cy } = pos(n.x, n.y)
          return (
            <circle key={n.occurrenceId} cx={cx} cy={cy} r={3.4} fill={depthColor(n.depth)}>
              <title>{n.label}</title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * 질문 목록.
 *
 * 설계 §7이 읽기 뷰에서 들여쓰기 트리를 금지한 건 무한 확장이 전제라서다. 여기는
 * 이미 끝난 트리라 깊이가 고정이고, 무엇 아래 무엇이 붙었는지가 이 화면의 본론이다.
 *
 * 다만 들여쓰기는 4단에서 멈춘다. 그 이상 밀면 모바일에서 질문 한 줄이 세로로 접힌다.
 * 4단을 넘는 깊이는 왼쪽 점 색이 계속 말해준다.
 */
const MAX_INDENT_STEPS = 4
const INDENT_PX = 14

function flatten(nodes: TreeNode[]): Array<{ node: TreeNode; depth: number }> {
  const childrenOf = new Map<string | null, TreeNode[]>()
  for (const n of nodes) {
    const list = childrenOf.get(n.parentOccurrenceId) ?? []
    list.push(n)
    childrenOf.set(n.parentOccurrenceId, list)
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.position - b.position)

  const out: Array<{ node: TreeNode; depth: number }> = []
  const seen = new Set<string>()

  // 깊이 우선으로 편다. 판 순서대로 읽힌다.
  // 재귀 대신 스택인 건 깊이 제한이 없어서다. 200단짜리 트리가 스택을 넘기면 안 된다.
  const stack = (childrenOf.get(null) ?? []).map((n) => ({ node: n, depth: 0 })).reverse()

  while (stack.length > 0) {
    const item = stack.pop()!
    if (seen.has(item.node.occurrenceId)) continue
    seen.add(item.node.occurrenceId)
    out.push(item)

    const kids = childrenOf.get(item.node.occurrenceId) ?? []
    for (let i = kids.length - 1; i >= 0; i -= 1) {
      stack.push({ node: kids[i], depth: item.depth + 1 })
    }
  }

  return out
}

export function SharedTree({ nodes }: Props) {
  const rows = flatten(nodes)

  return (
    <div className="space-y-5">
      <TreeShape nodes={nodes} />

      <ol className="space-y-0.5">
        {rows.map(({ node, depth }) => (
          <li
            key={node.occurrenceId}
            style={{ paddingLeft: Math.min(depth, MAX_INDENT_STEPS) * INDENT_PX }}
          >
            <Link
              href={`/q/${node.nodeId}`}
              className="group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden
                className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: depthColor(depth) }}
              />
              <span className="text-[15px] leading-[1.55] text-ink group-hover:text-accent">
                {node.question}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
