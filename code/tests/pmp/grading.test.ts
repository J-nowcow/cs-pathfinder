import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// Local edits must not load full scenarios/explanations from the question bank.
vi.mock('../../data/pmp-native-questions.json', () => {
  throw new Error('Full question bank reached the local-edit path')
})
import { pmpGrading, isPmpLesson } from '@/lib/pmp/grading'
import { changePmp } from '@/lib/pmp/storage'
import { parsePmpBackup } from '@/lib/pmp/backup'

const questions: {
  id: string
  node: string
  options: { correct: boolean }[]
}[] = JSON.parse(
  readFileSync(new URL('../../data/pmp-native-questions.json', import.meta.url), 'utf8'),
)
const now = new Date('2026-10-28T03:00:00Z')

describe('compact PMP grading boundary', () => {
  it('validates complete cross-lesson/case backups without loading display prose and rejects forged grading', () => {
    const answers = Object.fromEntries(questions.map(q => [q.id, { index: 0, correct: q.options[0].correct, at: now.toISOString() }]))
    const data = { version: 1, answers, bookmarks: questions.filter(q => q.id === q.node).map(q => q.id) }
    expect(parsePmpBackup(JSON.stringify(data))).toEqual(data)
    for (const q of questions) {
      const forged = { version: 1, answers: { [q.id]: { index: 0, correct: !q.options[0].correct, at: now.toISOString() } } }
      expect(() => parsePmpBackup(JSON.stringify(forged))).toThrow()
    }
  })

  it('retains every authored question identity, option position and correctness without prose', () => {
    expect(pmpGrading.size).toBe(83)
    expect([...pmpGrading.values()]).toEqual(questions.map(q => ({
      id: q.id, node: q.node, options: q.options.map(o => ({ correct: o.correct })),
    })))
    expect(questions.filter(q => isPmpLesson(q.id))).toHaveLength(74)
    expect(isPmpLesson('unknown')).toBe(false)
  })

  it('grades every lesson and connected-case choice exactly as the preserved source, keeping other records', () => {
    for (const q of questions) for (const [index, option] of q.options.entries()) {
      const original = { version: 1 as const, notes: { n74: 'keep' }, answers: {}, future: { keep: true } }
      const result = changePmp(original, { kind: 'answer', id: q.id, index }, now)
      expect(result.answers).toEqual({ [q.id]: { index, correct: option.correct, at: now.toISOString() } })
      expect(result.review).toEqual(option.correct ? undefined : { [q.node]: expect.objectContaining({ due: now.toISOString(), interval: 0 }) })
      expect(result.notes).toBe(original.notes)
      expect(result.future).toBe(original.future)
      expect(original.answers).toEqual({})
    }
  })

  it('rejects invalid choices/identities and preserves all lesson visit and retry semantics', () => {
    for (const q of questions) {
      for (const index of [-1, q.options.length, NaN, 1.5])
        expect(() => changePmp({ version: 1 }, { kind: 'answer', id: q.id, index }, now)).toThrow()
      const result = changePmp({ version: 1, answers: { [q.id]: { index: 0 } }, notes: { n01: 'keep' } }, { kind: 'retry', id: q.id }, now)
      expect(result.answers).toEqual({})
      expect(result.notes).toEqual({ n01: 'keep' })
      if (q.id === q.node) {
        const visit = changePmp({ version: 1 }, { kind: 'visit', id: q.id }, now)
        expect(visit.seen).toEqual({ [q.id]: now.toISOString() })
      } else expect(() => changePmp({ version: 1 }, { kind: 'visit', id: q.id }, now)).toThrow()
    }
    expect(() => changePmp({ version: 1 }, { kind: 'answer', id: 'unknown', index: 0 }, now)).toThrow()
  })
})
