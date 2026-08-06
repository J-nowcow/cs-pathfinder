import { describe, it, expect } from 'vitest'
import { depthColor, DEPTH_LEVELS } from '@/lib/journey/depth'

describe('depthColor', () => {
  it('gives each level its own token', () => {
    const seen = new Set(
      Array.from({ length: DEPTH_LEVELS }, (_, i) => depthColor(i)),
    )
    expect(seen.size).toBe(DEPTH_LEVELS)
  })

  it('clamps beyond the last level instead of producing an undefined token', () => {
    expect(depthColor(99)).toBe(depthColor(DEPTH_LEVELS - 1))
  })

  it('clamps a negative depth to the first level', () => {
    expect(depthColor(-3)).toBe(depthColor(0))
  })
})
