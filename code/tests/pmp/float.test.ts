import { describe, expect, it } from 'vitest'
import { calculateFloat, parseFloatDuration } from '@/lib/pmp/float'
import course from '../../pm-content/pmp/source/course.json'
const network = course.floatLab
describe('authored five-activity CPM calculation', () => {
  it('matches the independently worked default example, including shared float', () => {
    const result = calculateFloat(network, network.defaults)!
    expect(result.total).toBe(12)
    expect(result.critical.map((p) => p.ids.join(''))).toEqual(['ABD'])
    expect(result.rows).toEqual({
      A: { duration: 2, es: 0, ef: 2, ls: 0, lf: 2, tf: 0, ff: 0 },
      B: { duration: 6, es: 2, ef: 8, ls: 2, lf: 8, tf: 0, ff: 0 },
      C: { duration: 2, es: 2, ef: 4, ls: 4, lf: 6, tf: 2, ff: 0 },
      E: { duration: 2, es: 4, ef: 6, ls: 6, lf: 8, tf: 2, ff: 2 },
      D: { duration: 4, es: 8, ef: 12, ls: 8, lf: 12, tf: 0, ff: 0 },
    })
  })
  it('agrees with independent closed-form path equations across 1024 networks', () => {
    for (let A = 1; A <= 4; A++)
      for (let B = 1; B <= 4; B++)
        for (let C = 1; C <= 4; C++)
          for (let E = 1; E <= 4; E++)
            for (let D = 1; D <= 4; D++) {
              const r = calculateFloat(network, { A, B, C, E, D })!
              const join = A + Math.max(B, C + E)
              expect(r.total).toBe(join + D)
              expect([r.rows.B.tf, r.rows.B.ff]).toEqual([
                join - A - B,
                join - A - B,
              ])
              expect([r.rows.C.tf, r.rows.C.ff]).toEqual([join - A - C - E, 0])
              expect([r.rows.E.tf, r.rows.E.ff]).toEqual([
                join - A - C - E,
                join - A - C - E,
              ])
              expect([r.rows.C.ls, r.rows.E.ls, r.rows.D.es]).toEqual([
                join - E - C,
                join - E,
                join,
              ])
              expect(r.critical.length).toBe(B === C + E ? 2 : 1)
              for (const row of Object.values(r.rows)) {
                expect(row.tf).toBe(row.lf - row.ef)
                expect(row.ff).toBeGreaterThanOrEqual(0)
                expect(row.ff).toBeLessThanOrEqual(row.tf)
              }
            }
  })
  it('shows path tie, switch and shared allowance without mutating source data', () => {
    const snapshot = JSON.stringify(network)
    expect(
      network.presets.map((p) => {
        const r = calculateFloat(network, p.durations)!
        return [r.total, r.critical.length, r.rows.C.tf]
      }),
    ).toEqual([
      [12, 1, 2],
      [12, 1, 1],
      [12, 2, 0],
      [13, 1, 0],
      [12, 2, 0],
    ])
    expect(
      calculateFloat(network, { A: 100, B: 100, C: 100, E: 100, D: 100 })!
        .total,
    ).toBe(400)
    expect(JSON.stringify(network)).toBe(snapshot)
  })
  it('rejects missing, non-finite, fractional, negative and out-of-range durations', () => {
    for (const C of [NaN, Infinity, 0, -1, 1.5, 101]) {
      expect(calculateFloat(network, { ...network.defaults, C })).toBeNull()
    }
    expect(calculateFloat(network, {})).toBeNull()
    for (const value of ['', ' ', '1.5', '1e2', 'Infinity', '-1', '0', '101'])
      expect(parseFloatDuration(value)).toBeNull()
    expect(parseFloatDuration('100')).toBe(100)
    expect(parseFloatDuration(' 2 ')).toBe(2)
  })
})
