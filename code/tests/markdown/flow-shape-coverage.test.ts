import { describe, it, expect } from 'vitest'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import { parseBlocks } from '@/lib/markdown/blocks'
import { flowShape } from '@/lib/markdown/flow-shape'

/**
 * **새 도식이 실제로 몇 편에 붙는가.**
 *
 * `:::flow` 개수는 지표가 아니다. 저장된 문법일 뿐이고 화면에 나가는 그림은
 * `flowShape()`가 고른다 — 왕복이면 기둥, 선형이면 사슬, 나머지는 예전 모양
 * 그대로다. 그래서 **`flow`가 늘어도 새 그림을 받는 수는 그대로일 수 있다.**
 *
 * 이 시험이 지키는 것은 그 비율이다. `MAX_LANES`를 줄이거나 판별 조건을
 * 조이면 화면이 조용히 옛 모양으로 돌아간다. 렌더러는 멀쩡하고 시험도
 * 통과하고 글도 그대로다 — **그림만 바뀐다.** 눈으로 열어 보지 않으면 모른다.
 *
 * 개수가 아니라 **비율**로 건다. 앞으로 `flow`를 다른 종류로 옮기는 작업이
 * 있을 텐데(실제로 A2·A4에서 했다) 개수로 걸면 그때마다 이 시험이 운다.
 */
const ALL = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]

function tally() {
  const t = { sequence: 0, chain: 0, other: 0 }
  for (const n of ALL) {
    for (const b of parseBlocks(n.body)) {
      if (b.type === 'flow') t[flowShape(b.steps)] += 1
    }
  }
  return t
}

describe('flow가 실제로 받는 그림', () => {
  it('flow 블록이 충분히 있다', () => {
    const t = tally()
    /* 표본이 얇으면 아래 비율이 아무것도 안 지킨다 */
    expect(t.sequence + t.chain + t.other).toBeGreaterThan(50)
  })

  /**
   * 실측 이력 — 처음 잰 값 52/72(72%), 지금 69/90(77%).
   * 70%를 바닥으로 둔다. 이보다 떨어지면 판별기가 좁아진 것이다.
   */
  it('절반을 훌쩍 넘는 flow가 새 그림을 받는다', () => {
    const t = tally()
    const total = t.sequence + t.chain + t.other
    const drawn = t.sequence + t.chain
    expect(drawn / total).toBeGreaterThanOrEqual(0.7)
  })

  /* 한쪽만 살아 있어도 비율은 채워진다. 둘 다 실제로 쓰이는지 따로 본다 */
  it('기둥과 사슬이 둘 다 쓰인다', () => {
    const t = tally()
    expect(t.sequence).toBeGreaterThan(10)
    expect(t.chain).toBeGreaterThan(10)
  })
})
