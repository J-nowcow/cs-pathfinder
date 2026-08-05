import { describe, it, expect } from 'vitest'
import { serializeJourney, deserializeJourney } from '@/lib/journey/storage'
import { startJourney, visit } from '@/lib/journey/path'
import type { VisitedNode } from '@/lib/journey/types'

const node = (id: string): VisitedNode => ({ id, question: `질문 ${id}`, category: '네트워크' })

describe('journey storage', () => {
  it('round-trips a state', () => {
    const s0 = startJourney(node('A'))
    const s1 = visit(s0, s0.currentId!, node('B')).state

    expect(deserializeJourney(serializeJourney(s1))).toEqual(s1)
  })

  it('returns null for broken json rather than throwing', () => {
    // 던지면 읽기 뷰가 통째로 죽는다. 여정을 새로 시작하는 편이 낫다.
    expect(deserializeJourney('{not json')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(deserializeJourney(null)).toBeNull()
  })

  it('rejects a payload from an older schema', () => {
    expect(deserializeJourney(JSON.stringify({ version: 0, occurrences: [] }))).toBeNull()
  })

  it('rejects a payload whose occurrences are not an array', () => {
    expect(deserializeJourney(JSON.stringify({ version: 1, occurrences: {} }))).toBeNull()
  })

  it('rejects an occurrence missing required fields', () => {
    const payload = JSON.stringify({
      version: 1,
      currentId: 'x',
      occurrences: [{ id: 'x', nodeId: 'A' }],
    })
    expect(deserializeJourney(payload)).toBeNull()
  })

  it('drops a currentId that points at nothing', () => {
    const payload = JSON.stringify({
      version: 1,
      currentId: 'ghost',
      occurrences: [
        { id: 'x', nodeId: 'A', parentId: null, question: 'q', category: 'c' },
      ],
    })
    expect(deserializeJourney(payload)!.currentId).toBe('x')
  })
})
