import { describe, expect, it } from 'vitest'
import { journeyToWire } from '@/lib/journey/wire'

describe('journey wire field boundary', () => {
  it('excludes extra server/account fields without mutating the source snapshot', () => {
    const snapshot = {
      occurrences: [
        {
          id: 'root',
          nodeId: 'node',
          parentId: null,
          question: 'Public label',
          category: 'network',
          ownerId: 'synthetic-owner',
          pathKey: 'internal-path',
          createdAt: 'internal-time',
        },
      ],
      currentId: 'root',
      accountEmail: 'synthetic@example.invalid',
    }
    const before = structuredClone(snapshot)
    expect(journeyToWire(snapshot)).toEqual({
      occurrences: [
        {
          id: 'root',
          node_id: 'node',
          parent_id: null,
          question: 'Public label',
          category: 'network',
        },
      ],
      current_id: 'root',
    })
    expect(snapshot).toEqual(before)
  })
})
