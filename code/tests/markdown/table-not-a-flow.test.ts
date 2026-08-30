import { describe, it, expect } from 'vitest'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import { parseBlocks } from '@/lib/markdown/blocks'

/**
 * **표 안에 흐름을 그리지 않는다.**
 *
 * `measure:corpus`가 오래 "견주는 질문이 아닌데 표만 있는 편 105"를 찍고
 * 있었다. 그 숫자를 믿고 백 편을 다른 도식으로 옮길 뻔했는데, 열어 보니
 * **일흔 편이 오탐**이었다. 판정이 제목만 봐서 그렇다 —
 * `volatile은 무엇을 보장하고 놓치는가?`는 제목에 "차이"가 없지만 표 머리가
 * `기준 | volatile | synchronized`다. 표가 스스로 견주는 표라고 말하고 있다.
 *
 * 실제로 잘못 쓴 표는 표 173개 중 **하나**였고, 그것은 제목이 아니라 표
 * 안에서 드러났다. 첫 칸이 `발행자 → 브로커`처럼 구간이면 그 표의 행 축은
 * 견줄 대상이 아니라 흐름이다.
 *
 * 그래서 시험이 지키는 것은 지표가 아니라 **그 신호**다. 표의 첫 칸에
 * 화살표가 들어가면 flow로 쓸 자리를 표로 쓴 것이다.
 *
 * 하나 남겨 둔 예외가 `메시지 큐를 두면 무엇을 얻고 무엇을 잃는가?`다.
 * 구간마다 사실이 둘씩(넘기는 조건·비었을 때 생기는 일) 있어서 flow로
 * 옮기면 열 하나를 잃는다. **고치는 편이 나빠지는 자리라 그대로 둔다.**
 * 여기 이름을 적어 두는 이유는, 적어 두지 않으면 다음 사람이 같은 판단을
 * 처음부터 다시 하기 때문이다.
 */
const ALL = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]
const HOP = /(->|→|=>)/

/** 옮기면 정보를 잃는다고 판단해 남긴 것. 늘리려면 위 주석의 이유를 넘어서야 한다 */
const ALLOWED = new Set(['메시지 큐를 두면 무엇을 얻고 무엇을 잃는가?'])

describe('표에 흐름을 그리지 않는다', () => {
  it('표의 첫 칸에 화살표가 없다', () => {
    const bad: string[] = []
    for (const node of ALL) {
      if (ALLOWED.has(node.question)) continue
      for (const b of parseBlocks(node.body)) {
        if (b.type !== 'table') continue
        if (b.rows.some((r) => HOP.test(r[0] ?? ''))) bad.push(node.question)
      }
    }
    expect(bad).toEqual([])
  })

  /* 예외 목록이 조용히 불어나는 것을 막는다 */
  it('예외는 하나뿐이다', () => {
    expect(ALLOWED.size).toBe(1)
  })
})
