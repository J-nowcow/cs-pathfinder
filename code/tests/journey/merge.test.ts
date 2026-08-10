import { describe, it, expect } from 'vitest'
import { startJourney, visit, pathTo } from '@/lib/journey/path'
import { pathKeyOf, mergeJourney } from '@/lib/journey/merge'
import type { JourneyState, Occurrence } from '@/lib/journey/types'

/**
 * **병합 규칙(auth-design §2)을 고정한다.**
 *
 * 지난 버그의 모양 — "비어 있는 새 상태가 진짜 데이터를 덮는다" — 이
 * 병합 층에서 재발하면 이번에는 서버까지 오염된다. 규칙 셋:
 * ① 더하기만(치환 없음) ② currentId는 로컬 우선 ③ 결과는 항상 이어진 숲.
 *
 * 발자국의 정체성은 id가 아니라 pathKey다. id는 브라우저가 만들어
 * 기기마다 다르다 — id로 합치면 같은 경로가 기기 수만큼 복제된다.
 */

/** A → B 두 발자국짜리 로컬 여정 */
function twoNodeLocal(): JourneyState {
  const start = startJourney({ id: 'node-A', question: 'A?', category: '망' })
  return visit(start, start.currentId!, { id: 'node-B', question: 'B?', category: '망' }).state
}

/** 서버가 내려주는 모양 — 서버 uuid를 단 Occurrence 배열 (position 순) */
function serverSet(): Occurrence[] {
  return [
    { id: 'srv-1', nodeId: 'node-A', parentId: null, question: 'A?', category: '망' },
    { id: 'srv-2', nodeId: 'node-B', parentId: 'srv-1', question: 'B?', category: '망' },
  ]
}

describe('pathKeyOf', () => {
  it('뿌리부터 nodeId를 >로 잇는다', () => {
    const local = twoNodeLocal()
    expect(pathKeyOf(local, local.occurrences[0].id)).toBe('node-A')
    expect(pathKeyOf(local, local.occurrences[1].id)).toBe('node-A>node-B')
  })
})

describe('mergeJourney', () => {
  /** M1 ★ 서버가 비어도 로컬이 산다 — 지난 버그의 직계 */
  it('서버가 비었을 때 로컬이 전부 살아남는다', () => {
    const local = twoNodeLocal()
    const out = mergeJourney(local, [], null)
    expect(out.occurrences.map((o) => o.nodeId)).toEqual(['node-A', 'node-B'])
    expect(out.currentId).toBe(local.currentId)
  })

  /** M2 ★ 로컬이 빈 새 기기는 서버를 그대로 받고 서버 커서에 선다 */
  it('로컬이 비었을 때 서버가 내려오고 서버 커서를 쓴다', () => {
    const out = mergeJourney({ occurrences: [], currentId: null }, serverSet(), 'srv-2')
    expect(out.occurrences.map((o) => o.id)).toEqual(['srv-1', 'srv-2'])
    expect(out.currentId).toBe('srv-2')
  })

  /** M3 ★ 같은 경로는 하나로 — 그리고 서버 id가 남아야 다음 동기화가 안정된다 */
  it('겹치는 경로는 중복 없이 서버 id로 남는다', () => {
    const local = twoNodeLocal()
    const out = mergeJourney(local, serverSet(), null)
    expect(out.occurrences).toHaveLength(2)
    expect(out.occurrences.map((o) => o.id)).toEqual(['srv-1', 'srv-2'])
  })

  /** M4 ★ 결과는 항상 이어진 숲 — 로컬 전용 가지의 부모가 서버 id로 재매핑된다 */
  it('로컬에만 있는 가지는 서버 발자국 아래로 이어 붙는다', () => {
    const local = twoNodeLocal()
    const withC = visit(local, local.occurrences[1].id, {
      id: 'node-C',
      question: 'C?',
      category: '망',
    }).state
    const out = mergeJourney(withC, serverSet(), null)

    expect(out.occurrences).toHaveLength(3)
    const c = out.occurrences.find((o) => o.nodeId === 'node-C')!
    // B는 서버 id(srv-2)로 접혔으므로 C의 부모도 srv-2여야 한다
    expect(c.parentId).toBe('srv-2')

    // 고아 없음 + 부모가 항상 자식보다 앞 (graph/storage가 이 전제를 쓴다)
    const seen = new Set<string>()
    for (const o of out.occurrences) {
      if (o.parentId !== null) expect(seen.has(o.parentId)).toBe(true)
      seen.add(o.id)
    }
    // 병합 뒤에도 경로 계산이 뿌리까지 닿는다
    expect(pathTo(out, c.id).map((o) => o.nodeId)).toEqual(['node-A', 'node-B', 'node-C'])
  })

  /** M5 currentId는 로컬 우선 — 방금 판 자리를 잃는 쪽이 훨씬 아프다 */
  it('양쪽 다 커서가 있으면 로컬 자리가 이긴다 (공유 키면 서버 id로 매핑)', () => {
    const local = twoNodeLocal() // currentId = B (로컬 id)
    const out = mergeJourney(local, serverSet(), 'srv-1')
    // 로컬 B는 서버 srv-2로 접혔다 — 커서도 그 id를 가리켜야 한다
    expect(out.currentId).toBe('srv-2')
  })

  it('다른 경로로 같은 노드에 닿은 것은 따로 남는다 — visit 의미론', () => {
    // 서버: A>B. 로컬: C>B (다른 부모 아래 B)
    const start = startJourney({ id: 'node-C', question: 'C?', category: '망' })
    const local = visit(start, start.currentId!, { id: 'node-B', question: 'B?', category: '망' }).state
    const out = mergeJourney(local, serverSet(), null)
    // A, B(서버), C, B(로컬) — 경로가 다르므로 4개
    expect(out.occurrences).toHaveLength(4)
    expect(out.occurrences.filter((o) => o.nodeId === 'node-B')).toHaveLength(2)
  })
})
