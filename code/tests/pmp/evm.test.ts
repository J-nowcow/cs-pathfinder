import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  calculateEvm,
  EVM_DEFAULTS,
  formatEvm,
  parseEvmAmount,
} from '@/lib/pmp/evm'

describe('native EVM assumptions and boundaries', () => {
  it('distinguishes three forecasts for the same earned value data', () => {
    expect(calculateEvm(EVM_DEFAULTS)).toEqual({
      cpi: 0.8,
      spi: 0.8,
      cv: -10,
      sv: -10,
      remaining: 60,
      eacCpi: 125,
      etcCpi: 75,
      vacCpi: -25,
      eacPlan: 110,
      eacBottomUp: 120,
      tcpiBac: 1.2,
    })
    const changed = calculateEvm({ ...EVM_DEFAULTS, etc: 90 })!
    expect([changed.eacCpi, changed.eacPlan, changed.eacBottomUp]).toEqual([
      125, 110, 140,
    ])
    expect(calculateEvm({ ...EVM_DEFAULTS, etc: null })!.eacBottomUp).toBeNull()
  })
  it('matches the existing standalone core for 480 independently selected cases', () => {
    const source = readFileSync(
      new URL('../../pm-content/pmp/template/app.js', import.meta.url),
      'utf8',
    )
    const legacy = vm.runInNewContext(
      '(' + source.match(/function evmCalc\([^\n]+/)![0] + ')',
    )
    let count = 0
    for (const bac of [100, 120, 1000])
      for (const pvRate of [0, 0.25, 0.5, 1])
        for (const evRate of [0, 0.25, 0.5, 0.8, 1])
          for (const acRate of [0, 0.5, 1, 1.2, 2, 3, 4, 5]) {
            const pv = bac * pvRate,
              ev = bac * evRate,
              ac = bac * acRate
            const result = calculateEvm({ bac, pv, ev, ac, etc: null })!
            const old = legacy(bac, pv, ev, ac)
            expect([
              result.cpi,
              result.spi,
              result.cv,
              result.sv,
              result.eacCpi,
              result.tcpiBac,
            ]).toEqual([old.cpi, old.spi, old.cv, old.sv, old.eac, old.tcpi])
            // Independent expression: total cost = actual + remaining budget * cost per earned unit.
            if (ev > 0 && ac > 0)
              expect(result.eacCpi!).toBeCloseTo(ac + ((bac - ev) * ac) / ev, 8)
            count++
          }
    expect(count).toBe(480)
  })
  it('keeps undefined ratios distinct from zero and permits real cost above BAC', () => {
    const noActual = calculateEvm({ ...EVM_DEFAULTS, ac: 0 })!
    expect([
      noActual.cpi,
      noActual.eacCpi,
      noActual.etcCpi,
      noActual.vacCpi,
    ]).toEqual([null, null, null, null])
    expect(calculateEvm({ ...EVM_DEFAULTS, pv: 0 })!.spi).toBeNull()
    expect(calculateEvm({ ...EVM_DEFAULTS, ev: 0 })!.cpi).toBe(0)
    expect(calculateEvm({ ...EVM_DEFAULTS, ev: 0 })!.eacCpi).toBeNull()
    for (const ac of [100, 120])
      expect(calculateEvm({ ...EVM_DEFAULTS, ac })!.tcpiBac).toBeNull()
    const done = calculateEvm({ bac: 100, pv: 100, ev: 100, ac: 120, etc: 0 })!
    expect([
      done.remaining,
      done.eacCpi,
      done.eacPlan,
      done.eacBottomUp,
    ]).toEqual([0, 120, 120, 120])
    expect(
      calculateEvm({ bac: 100, pv: 100, ev: 100, ac: 80, etc: 0 })!.tcpiBac,
    ).toBe(0)
  })
  it('validates required values without quietly accepting empty, exponent or invalid money text', () => {
    for (const text of [
      '',
      ' ',
      '-1',
      'Infinity',
      'NaN',
      '1e2',
      '0x10',
      '0.001',
      '100000000.01',
    ])
      expect(parseEvmAmount(text)).toBeNull()
    for (const [text, value] of [
      ['0', 0],
      ['.25', 0.25],
      ['10.20', 10.2],
      ['100000000', 100000000],
    ] as const)
      expect(parseEvmAmount(text)).toBe(value)
    for (const [key, value] of [
      ['bac', 0],
      ['pv', 101],
      ['ev', 101],
      ['etc', -1],
      ['ac', Infinity],
      ['ac', NaN],
      ['ac', 1e9],
      ['ev', 0.001],
    ] as const)
      expect(calculateEvm({ ...EVM_DEFAULTS, [key]: value })).toBeNull()
    const tiny = calculateEvm({ bac: 1e8, pv: 0, ev: 0.01, ac: 1e8, etc: 1e8 })!
    expect(
      Object.values(tiny).every((v) => v === null || Number.isFinite(v)),
    ).toBe(true)
    expect(formatEvm(tiny.cpi)).not.toBe('0')
    expect(formatEvm(null)).toBe('계산 불가')
    expect(formatEvm(-0)).toBe('0')
  })
})
