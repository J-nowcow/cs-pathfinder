import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import {
  parsePmpBackup,
  planPmpBackup,
  applyPmpBackup,
  PmpBackupChanged,
} from '@/lib/pmp/backup'
import { PMP_KEY } from '@/lib/pmp/storage'
import { pmpQuestions } from '@/lib/pmp/questions'
const at = '2026-10-28T00:00:00.000Z',
  later = '2026-10-29T00:00:00.000Z'
const raw = (x: Record<string, unknown>) => JSON.stringify({ version: 1, ...x })
const q = pmpQuestions.get('n01')!
const answer = (index = 0, time = at) => ({
  index,
  correct: q.options[index].correct,
  at: time,
})
function store(value: string | null) {
  const all: Record<string, string> = {
    'pathfinder.library.v1': 'keep-library',
    'pathfinder.certificate.v1': 'keep-certificate',
  }
  if (value !== null) all[PMP_KEY] = value
  return {
    all,
    getItem: (k: string) => all[k] ?? null,
    setItem: (k: string, v: string) => {
      all[k] = v
    },
  }
}
describe('PMP full legacy backup', () => {
  it('accepts every real legacy lesson/case record and round-trips through the preserved HTML sanitizer', () => {
    const course = JSON.parse(
      readFileSync(
        new URL('../../pm-content/pmp/source/course.json', import.meta.url),
        'utf8',
      ),
    )
    const source = readFileSync(
      new URL('../../pm-content/pmp/template/app.js', import.meta.url),
      'utf8',
    )
    const fn = source.slice(
      source.indexOf('function sanitize(raw){'),
      source.indexOf('\ntry{const raw=localStorage'),
    )
    const context: { course: unknown; sanitize?: (x: unknown) => unknown } = {
      course,
    }
    const empty = source
      .split('\n')
      .find((line) => line.startsWith('const empty=()=>'))!
    runInNewContext(
      `const C=course;const byId=Object.fromEntries(C.nodes.map(n=>[n.id,n]));const questions=Object.fromEntries([...C.nodes.map(n=>[n.id,n]),...C.cases.flatMap(c=>c.questions.map(q=>[q.id,q]))]);${empty}\n${fn};this.sanitize=sanitize`,
      context,
    )
    const legacy: Record<string, unknown> = {
      version: 1,
      seen: {},
      journey: [],
      answers: {},
      notes: {},
      thoughts: {},
      bookmarks: course.nodes.map((n: { id: string }) => n.id),
      review: {},
      recall: {},
      prefs: { font: 'batang', size: 20, theme: 'light' },
      exportedAt: at,
    }
    for (const n of course.nodes) {
      for (const [field, value] of Object.entries({
        seen: at,
        notes: 'Synthetic note ' + n.id,
        thoughts: 'Synthetic recall ' + n.id,
        recall: 'good',
        review: { due: later, interval: 3, rating: 'good' },
      }))
        (legacy[field] as Record<string, unknown>)[n.id] = value
      ;(legacy.journey as unknown[]).push({ id: n.id, from: null, at })
    }
    for (const [id, question] of pmpQuestions)
      (legacy.answers as Record<string, unknown>)[id] = {
        index: 0,
        correct: question.options[0].correct,
        at,
      }
    const imported = parsePmpBackup(JSON.stringify(legacy))
    const state = planPmpBackup(null, JSON.stringify(imported)).state
    expect(Object.keys(state.answers as object)).toHaveLength(83)
    expect(context.sanitize!(state)).toEqual(context.sanitize!(legacy))
    expect(state.exportedAt).toBeUndefined() // File metadata is not a learning record.
  })
  it('merges disjoint entries, newer seen/same answers, bookmarks and unique paths without touching other keys', () => {
    const current = raw({
      notes: { n01: 'Keep' },
      seen: { n01: later },
      answers: { n01: answer(0, at) },
      bookmarks: ['n01'],
      journey: [{ id: 'n01', from: null, at }],
    })
    const incoming = raw({
      thoughts: { n02: 'New' },
      seen: { n01: at, n02: later },
      answers: { n01: answer(0, later) },
      bookmarks: ['n01', 'n02'],
      journey: [
        { id: 'n01', from: null, at },
        { id: 'n02', from: 'n01', at: later },
      ],
    })
    const s = store(current)
    applyPmpBackup(s, current, incoming)
    expect(s.all['pathfinder.library.v1']).toBe('keep-library')
    expect(s.all['pathfinder.certificate.v1']).toBe('keep-certificate')
    const result = parsePmpBackup(s.all[PMP_KEY])
    expect(result.notes).toEqual({ n01: 'Keep' })
    expect(result.thoughts).toEqual({ n02: 'New' })
    expect(result.seen).toEqual({ n01: later, n02: later })
    expect(result.answers).toEqual({ n01: answer(0, later) })
    expect(result.bookmarks).toEqual(['n01', 'n02'])
    expect(result.journey).toHaveLength(2)
  })
  it('requires explicit per-field choices for different or blank text, answers, review, recall and prefs', () => {
    const current = raw({
      notes: { n01: 'Original', n02: 'Untouched' },
      thoughts: { n01: 'Own explanation' },
      answers: { n01: answer() },
      review: { n01: { due: at, interval: 1, rating: 'hard' } },
      recall: { n01: 'hard' },
      prefs: { font: 'suit', theme: 'dark' },
    })
    const incoming = raw({
      notes: { n01: '' },
      thoughts: { n01: 'Backup explanation' },
      answers: { n01: answer(1, later) },
      review: { n01: { due: later, interval: 3, rating: 'good' } },
      recall: { n01: 'good' },
      prefs: { font: 'batang', theme: 'light' },
    })
    const plan = planPmpBackup(current, incoming)
    expect(plan.unresolved).toHaveLength(7)
    const s = store(current)
    expect(() => applyPmpBackup(s, current, incoming)).toThrow('선택')
    expect(s.all[PMP_KEY]).toBe(current)
    const picks = Object.fromEntries(
      plan.conflicts.map((c) => [
        c.key,
        c.field === 'notes' ? 'current' : 'incoming',
      ]),
    ) as Record<string, 'current' | 'incoming'>
    const result = applyPmpBackup(s, current, incoming, picks)
    expect(result.notes).toEqual({ n01: 'Original', n02: 'Untouched' })
    expect(result.thoughts).toEqual({ n01: 'Backup explanation' })
    expect(result.prefs).toEqual({ font: 'batang', theme: 'light' })
  })
  it('never silently replaces malformed/unknown current state or silently drops invalid imported entries', () => {
    const candidates = [
      '{',
      raw({ future: { keep: true } }),
      raw({ notes: { n99: 'future lesson' } }),
      raw({ notes: { n01: 'x'.repeat(12001) } }),
      raw({ seen: 'broken' }),
      raw({ answers: { n01: { ...answer(), correct: !answer().correct } } }),
      raw({ prefs: { font: ['suit'] } }),
      '{}',
      '{"version":2}',
      '{"version":1,"__proto__":{"x":true}}',
    ]
    for (const value of candidates) {
      const s = store(value)
      expect(() =>
        applyPmpBackup(s, value, raw({ notes: { n02: 'New' } })),
      ).toThrow()
      expect(s.all[PMP_KEY]).toBe(value)
      expect(() => parsePmpBackup(value)).toThrow()
    }
    expect(() => parsePmpBackup(' '.repeat(8_000_001) + raw({}))).toThrow('8MB')
  })
  it('rejects changes after preview and propagates write failure without changing the original', () => {
    const current = raw({ notes: { n01: 'Original' } }),
      incoming = raw({ notes: { n02: 'Backup' } }),
      s = store(current)
    s.all[PMP_KEY] = raw({ notes: { n01: 'New edit' } })
    expect(() => applyPmpBackup(s, current, incoming)).toThrow(PmpBackupChanged)
    const before = s.all[PMP_KEY]
    expect(() =>
      applyPmpBackup(
        {
          ...s,
          setItem: () => {
            throw Error('quota')
          },
        },
        before,
        incoming,
      ),
    ).toThrow('quota')
    expect(s.all[PMP_KEY]).toBe(before)
  })
  it('does not truncate combined journey beyond5000 without an explicit whole-history choice', () => {
    const paths = (id: string) =>
      Array.from({ length: 5000 }, (_, i) => ({
        id,
        from: null,
        at: new Date(Date.parse(at) + i * 1000).toISOString(),
      }))
    const current = raw({ journey: paths('n01') }),
      incoming = raw({ journey: paths('n02') })
    expect(
      planPmpBackup(current, incoming).unresolved.map((x) => x.key),
    ).toEqual(['journey/all'])
    const s = store(current)
    expect(() => applyPmpBackup(s, current, incoming)).toThrow()
    expect(s.all[PMP_KEY]).toBe(current)
    expect(
      applyPmpBackup(s, current, incoming, { 'journey/all': 'incoming' })
        .journey,
    ).toEqual(paths('n02'))
  })
})
