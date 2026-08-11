import { describe, it, expect } from 'vitest'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import { contentIssues, blocking, questionIssues, rewriteNeeded } from '@/lib/llm/content-rules'
import { CATEGORIES } from '@/lib/tree/categories'

/**
 * **말뭉치 전체가 규칙을 지키는가.**
 *
 * 생성기는 규칙을 검사하고 한 번 다시 부른다. 두 번째도 어긋나면 덜 어긋난
 * 쪽을 내보낸다 -- 그 판단은 옳다. 문단이 170자인 해설은 읽기 불편할 뿐이지만
 * 거기서 예외를 던지면 사용자는 아무것도 못 받는다.
 *
 * 문제는 그렇게 나간 글을 **되돌아와 고치는 절차가 없었다는 것**이다. 재 보니
 * 291편 중 25편이 어긋난 채였다. 낡은 사실 7건, 35자를 넘는 단추 44개,
 * 경어체 단추 15개, 겹친 조사, 문법이 깨진 자리, 통째로 사라진 도식이 있었다.
 * 전부 고쳐 0으로 만들었다.
 *
 * 이 시험이 그 0을 지킨다. 없으면 다음에 또 25편이 된다.
 *
 * **새 글을 넣다가 여기서 걸리면 시험을 고치지 말고 글을 고쳐라.** 규칙 자체가
 * 틀렸다고 생각되면 규칙을 고치고 그 근거를 남겨라.
 */
const SETS = [
  ['손으로 쓴 것', EXAMPLE_NODES],
  ['손으로 쓴 것(추가)', AUTHORED_NODES],
  ['모델이 쓴 것(배치)', GENERATED_NODES],
  ['모델이 쓴 것(물어봐서)', ON_DEMAND_NODES],
] as const

/**
 * **분야 이름이 목록 안에 있는가.**
 *
 * `/questions`와 지도와 공개 말뭉치가 전부 `CATEGORIES`를 돌면서 그 분야에
 * 속한 것만 모은다. 목록에 없는 이름을 적으면 **그 질문은 어디에도 안 나온다.**
 * 오류도 안 나고 화면도 멀쩡하다. 그냥 없는 것이 된다.
 *
 * 실제로 `기타`라고 적었다가 걸렸다. 타입은 `string`이라 컴파일도 통과했다.
 */
describe('분야 이름', () => {
  it('전부 목록 안에 있다', () => {
    const known = new Set<string>(CATEGORIES)
    const bad = SETS.flatMap(([, nodes]) => nodes)
      .filter((n) => !known.has(n.category))
      .map((n) => `${n.category} · ${n.question}`)
    expect(bad).toEqual([])
  })
})

describe('말뭉치 전체', () => {
  for (const [label, nodes] of SETS) {
    it(`${label} 가운데 규칙에 걸리는 편이 없다`, () => {
      /* 배열이 비면 무엇을 지워도 통과한다. 먼저 있는지 본다 */
      expect(nodes.length).toBeGreaterThan(10)

      const bad = nodes
        .filter((n) => blocking(contentIssues({ body: n.body, suggestions: n.suggestions })).length)
        .map((n) => n.question)
      expect(bad).toEqual([])
    })
  }

  it('재작성이 필요한 AI식 문체와 긴 제목이 남지 않는다', () => {
    const bad = SETS.flatMap(([, nodes]) => nodes).flatMap((node) => {
      const issues = [
        ...rewriteNeeded(contentIssues({ body: node.body, suggestions: node.suggestions })),
        ...questionIssues(node.question),
      ]
      return issues.length > 0 ? [`${node.question}: ${issues.map((issue) => issue.rule).join(', ')}`] : []
    })

    expect(bad).toEqual([])
  })
})
