import { describe, expect, it } from 'vitest'
import {
  calculateRisk,
  EQUAL_EXPECTATION_EXAMPLES,
  formatRisk,
  parseRiskAmount,
  RISK_DEFAULTS,
} from '@/lib/pmp/risk'
describe('two-event expected-loss model', () => {
  it('separates expected cost from threshold exceedance for identical expectations', () => {
    expect(calculateRisk(RISK_DEFAULTS)).toEqual({
      expectedLoss: 20,
      lowerExpectedCost: 'b',
      noEventPercent: 80,
      bExceedPercent: 20,
      aExceedPercent: 0,
    })
    expect(
      EQUAL_EXPECTATION_EXAMPLES.map((input) => {
        const r = calculateRisk(input)!
        return [r.expectedLoss, r.bExceedPercent]
      }),
    ).toEqual([
      [20, 20],
      [20, 10],
      [20, 0],
    ])
    expect(calculateRisk({ ...RISK_DEFAULTS, fixed: 60 })!.aExceedPercent).toBe(
      100,
    )
    expect(calculateRisk({ ...RISK_DEFAULTS, fixed: 50 })!.aExceedPercent).toBe(
      0,
    )
  })
  it('agrees with a BigInt outcome-enumeration oracle on1120 distributions', () => {
    let count = 0
    for (const probability of [0, 0.01, 10, 20, 33.33, 40, 99.99, 100])
      for (const loss of [0, 0.01, 0.29, 50, 100, 200, 1e6])
        for (const fixed of [0, 0.01, 20, 30, 1e6])
          for (const limit of [0, 50, 100, 1e6]) {
            const outcomes = [
              {
                weight: BigInt(Math.round(probability * 100)),
                cost: BigInt(Math.round(loss * 100)),
              },
              {
                weight: BigInt(10000 - Math.round(probability * 100)),
                cost: 0n,
              },
            ]
            const expectedNumerator = outcomes.reduce(
              (sum, o) => sum + o.weight * o.cost,
              0n,
            )
            const exceedsWeight = outcomes
              .filter((o) => o.cost > BigInt(Math.round(limit * 100)))
              .reduce((sum, o) => sum + o.weight, 0n)
            const fixedNumerator = BigInt(Math.round(fixed * 100)) * 10000n
            const r = calculateRisk({ probability, loss, fixed, limit })!
            expect(r.expectedLoss).toBe(Number(expectedNumerator) / 1e6)
            expect(r.bExceedPercent).toBe(Number(exceedsWeight) / 100)
            expect(r.lowerExpectedCost).toBe(
              expectedNumerator === fixedNumerator
                ? 'equal'
                : expectedNumerator < fixedNumerator
                  ? 'b'
                  : 'a',
            )
            expect(r.noEventPercent + probability).toBeCloseTo(100, 10)
            count++
          }
    expect(count).toBe(1120)
  })
  it('treats probability endpoints and exact threshold/expectation ties precisely', () => {
    expect(
      calculateRisk({ ...RISK_DEFAULTS, probability: 0 })!.bExceedPercent,
    ).toBe(0)
    expect(
      calculateRisk({ ...RISK_DEFAULTS, probability: 100 })!.bExceedPercent,
    ).toBe(100)
    expect(
      calculateRisk({ ...RISK_DEFAULTS, probability: 100, loss: 50 })!
        .bExceedPercent,
    ).toBe(0)
    expect(
      calculateRisk({ fixed: 0.07, probability: 0.07, loss: 100, limit: 50 })!
        .lowerExpectedCost,
    ).toBe('equal')
    expect(
      calculateRisk({ fixed: 0.29, probability: 50, loss: 0.58, limit: 0.58 })!
        .lowerExpectedCost,
    ).toBe('equal')
    expect(
      calculateRisk({ fixed: 0, probability: 0, loss: 0, limit: 0 })!
        .lowerExpectedCost,
    ).toBe('equal')
    expect(
      formatRisk(
        calculateRisk({ fixed: 0, probability: 0.01, loss: 0.01, limit: 0 })!
          .expectedLoss,
      ),
    ).toBe('0.000001')
  })
  it('rejects invalid and overprecise inputs rather than silently rounding them', () => {
    for (const value of [
      '',
      ' ',
      '-1',
      'Infinity',
      'NaN',
      '1e2',
      '0x10',
      '.001',
      '1000000.01',
    ])
      expect(parseRiskAmount(value)).toBeNull()
    expect(parseRiskAmount('100.01', 100)).toBeNull()
    expect(parseRiskAmount(' .29 ')).toBe(0.29)
    expect(parseRiskAmount('100', 100)).toBe(100)
    for (const [key, value] of [
      ['probability', 100.01],
      ['probability', 0.001],
      ['loss', -1],
      ['loss', Infinity],
      ['fixed', NaN],
      ['fixed', 1000001],
      ['limit', 0.001],
    ] as const)
      expect(calculateRisk({ ...RISK_DEFAULTS, [key]: value })).toBeNull()
  })
})
