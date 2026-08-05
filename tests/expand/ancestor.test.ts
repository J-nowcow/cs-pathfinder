import { describe, it, expect } from 'vitest'
import { findAncestorHit } from '@/lib/expand/ancestor'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'

describe('findAncestorHit', () => {
  it('returns null when the candidate is new to the path', () => {
    expect(findAncestorHit([A, B], C)).toBeNull()
  })

  it('returns the index when the candidate is already an ancestor', () => {
    expect(findAncestorHit([A, B, C], B)).toBe(1)
  })

  it('detects the root itself', () => {
    expect(findAncestorHit([A], A)).toBe(0)
  })

  it('returns null for an empty path', () => {
    expect(findAncestorHit([], A)).toBeNull()
  })

  it('returns the first occurrence when the path repeats a node', () => {
    expect(findAncestorHit([A, B, A], A)).toBe(0)
  })
})
