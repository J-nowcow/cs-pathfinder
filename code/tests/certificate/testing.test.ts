import { expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { certificate as c } from '@/lib/certificate/course'
import { certificateCoverageEdges as edges } from '@/lib/certificate/testing-graph'
import {
  changeCertificate,
  readCertificate,
  mergeCertificate,
} from '@/lib/certificate/storage'
const lesson = (id: string) => c.lessons.find((n) => n.id === id)!
const execute = (code: string, expression: string, context = {}) =>
  runInNewContext(code + '\n' + expression, context, { timeout: 1000 })

it('checks the displayed boundary table and81 integer cases against a separately enumerated allowed set', () => {
  const n = lesson('test-boundaries'),
    allowed = new Set(Array.from({ length: 21 }, (_, i) => i + 1))
  const samples = [0, 1, 2, 20, 21, 22, 2.5, '21']
  const values = execute(n.example.code!, 'inputs.map(acceptDays)', {
    inputs: samples,
  }) as boolean[]
  expect([...values]).toEqual(samples.map((x) => allowed.has(x as number)))
  expect(n.example.rows!.map((r) => r[1])).toEqual(
    [...values].map((v) => (v ? '허용' : '거부')),
  )
  const inputs: unknown[] = [
    ...Array.from({ length: 81 }, (_, i) => i - 40),
    null,
    undefined,
    '1',
    '21',
    true,
    false,
    NaN,
    Infinity,
    -Infinity,
    1.5,
  ]
  const actual = execute(n.example.code!, 'inputs.map(acceptDays)', {
    inputs,
  }) as boolean[]
  expect([...actual]).toEqual(
    inputs.map((x) => typeof x === 'number' && allowed.has(x)),
  )
})

function traceCoverage(
  input: boolean,
  code = lesson('test-coverage').example.code!,
) {
  // Instrument only this fixed, authored, explicitly labelled demonstration.
  const instrumented = code.replace(
    /^(\s*)(.+?)\s*\/\/ (S\d|D\d)$/gm,
    (_, indent, line, label) => `${indent}trace.push('${label}'); ${line}`,
  )
  const out = execute(
    instrumented,
    'const value=allowedDays(input);trace.push("end");({value,trace})',
    { input, trace: ['start'] },
  ) as { value: number; trace: string[] }
  const visited = out.trace
    .slice(1)
    .map(
      (to, i) => edges.find((e) => e.from === out.trace[i] && e.to === to)?.id,
    )
  expect(visited.every(Boolean)).toBe(true)
  return {
    value: out.value,
    statements: out.trace.filter((n) => /^S\d$/.test(n)),
    edges: visited as string[],
  }
}
it('enumerates all four Boolean test suites and ties published counts to actual labelled execution paths', () => {
  expect(edges.map((e) => [e.id, e.from, e.to])).toEqual([
    ['e1', 'start', 'S1'],
    ['e2', 'S1', 'D1'],
    ['e3', 'D1', 'S2'],
    ['e4', 'D1', 'S3'],
    ['e5', 'S2', 'S3'],
    ['e6', 'S3', 'end'],
  ])
  const suites = [[], [true], [false], [false, true]]
  const counts = suites.map((inputs) => {
    const traces = inputs.map((x) => traceCoverage(x))
    const statements = new Set(traces.flatMap((t) => t.statements)),
      branches = new Set(traces.flatMap((t) => t.edges))
    expect(traces.map((t) => t.value)).toEqual(
      inputs.map((extended) => (extended ? 21 : 7)),
    )
    return { s: statements.size, e: branches.size }
  })
  expect(counts).toEqual([
    { s: 0, e: 0 },
    { s: 3, e: 5 },
    { s: 2, e: 4 },
    { s: 3, e: 6 },
  ])
  for (const [i, row] of lesson('test-coverage').example.rows!.entries()) {
    const n = counts[i + 1]
    expect(row[2]).toContain(`${n.s}/3`)
    expect(row[3]).toContain(`${n.e}/6`)
    const percentage = (cell: unknown) =>
      Number(String(cell).match(/([\d.]+)%/)![1])
    expect(Math.abs(percentage(row[2]) - (n.s / 3) * 100)).toBeLessThan(0.005)
    expect(Math.abs(percentage(row[3]) - (n.e / 6) * 100)).toBeLessThan(0.005)
  }
})
it('shows a wrong return constant retaining full path coverage while an independent policy oracle rejects it', () => {
  const mutated = lesson('test-coverage').example.code!.replace(
    'days = 21',
    'days = 20',
  )
  const traces = [false, true].map((x) => traceCoverage(x, mutated))
  expect(new Set(traces.flatMap((t) => t.statements)).size).toBe(3)
  expect(new Set(traces.flatMap((t) => t.edges)).size).toBe(6)
  expect(traces[1].value).toBe(20)
  expect(traces[1].value).not.toBe(21)
})
it('checks the published before/after correction and unaffected inputs against the current contract', () => {
  const n = lesson('test-oracle-regression'),
    inputs = [21, 0, 1, 22, '21']
  const rows = execute(n.example.code!, 'inputs.map(x=>[before(x),after(x)])', {
    inputs,
  }) as boolean[][]
  expect(rows.map((r) => [...r])).toEqual([
    [false, true],
    [false, false],
    [true, true],
    [false, false],
    [false, false],
  ])
  for (const [i, row] of rows.entries()) {
    expect(n.example.rows![i].slice(1, 3)).toEqual(
      [...row].map((v) => (v ? '허용' : '거부')),
    )
    expect(n.example.rows![i][3]).toBe(row[1] ? '허용' : '거부')
  }
})
it('retains a complete earlier12-lesson record when the new domain is added and supports mixed backup roundtrips', () => {
  const at = '2026-10-27T16:00:00.000Z'
  const entries = Object.fromEntries(
    c.lessons
      .filter((n) => n.domain === 'db-sql')
      .map((n) => [
        n.id,
        {
          draft: 'Synthetic old ' + n.id,
          checks: [...n.checklist],
          visitedAt: at,
          updatedAt: at,
          due: '2026-10-30',
        },
      ]),
  )
  expect(Object.keys(entries)).toHaveLength(12)
  const old = readCertificate(JSON.stringify({ version: 1, entries }))
  let next = changeCertificate(
    old,
    'test-coverage',
    { kind: 'draft', text: 'Synthetic new note', expected: '' },
    new Date(at),
  )
  next = changeCertificate(
    next,
    'test-coverage',
    { kind: 'review', interval: 1 },
    new Date(at),
  )
  for (const id of Object.keys(entries))
    expect(next.entries[id]).toEqual(old.entries[id])
  expect(readCertificate(JSON.stringify(next))).toEqual(next)
  expect(mergeCertificate(old, next).state).toEqual(next)
  const other = changeCertificate(
    next,
    'test-coverage',
    { kind: 'draft', expected: 'Synthetic new note', text: 'Other note' },
    new Date(at),
  )
  expect(mergeCertificate(next, other).conflicts).toEqual(['test-coverage'])
})
