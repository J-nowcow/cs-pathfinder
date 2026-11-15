import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { certificateLessons } from '@/lib/certificate/course'
import previous from './fixtures/pre-security-identities.json'
import { certificateCatalog } from '@/lib/certificate/catalog'
import { certificateSyllabus } from '@/lib/certificate/syllabus'
import { changeCertificate, mergeCertificate, readCertificate } from '@/lib/certificate/storage'

const lesson = certificateLessons.get('input-validation-trust-boundary')!
const execute = (inputs: unknown[]) => [...runInNewContext(
  lesson.example.code + '\ninputs.map(acceptsLoanOptions)', { inputs }, { timeout: 1000 },
) as boolean[]]

it('verifies every displayed synthetic input result and a separate exhaustive allowed set', () => {
  const tableInputs = [
    { loanDays: 1, pickup: 'desk' }, { loanDays: 21, pickup: 'locker' },
    { loanDays: 0, pickup: 'desk' }, { loanDays: 22, pickup: 'desk' },
    { loanDays: '7', pickup: 'desk' }, { loanDays: 7.5, pickup: 'desk' },
    { loanDays: 7, pickup: 'courier' }, { loanDays: 7, pickup: 'desk', note: '추가' },
    { pickup: 'desk' }, null,
  ]
  const expected = [true, true, false, false, false, false, false, false, false, false]
  expect(execute(tableInputs)).toEqual(expected)
  expect(lesson.example.rows!.map(row => row[1])).toEqual(expected.map(ok => ok ? '허용' : '거부'))
  expect(lesson.example.verification).toContain('순수 JavaScript 실행')

  const allowed = new Set(Array.from({ length: 21 }, (_, i) => i + 1)
    .flatMap(days => ['desk', 'locker'].map(pickup => `${days}:${pickup}`)))
  const cases = Array.from({ length: 101 }, (_, i) => i - 50)
    .flatMap(loanDays => ['desk', 'locker', 'courier'].map(pickup => ({ loanDays, pickup })))
  expect(execute(cases)).toEqual(cases.map(value => allowed.has(`${value.loanDays}:${value.pickup}`)))
  const invalidValues = [NaN, Infinity, -Infinity, 1.5, '1', '21', '', null, undefined, true, 1n]
  expect(execute(invalidValues.map(loanDays => ({ loanDays, pickup: 'desk' })))).toEqual(invalidValues.map(() => false))
  expect(execute([undefined, [], {}, 'options', { loanDays: 7 }, { loanDays: 7, pickup: null }])).toEqual(Array(6).fill(false))
})

it('adds one partial security lesson and preserves all earlier lesson records on backup/merge', () => {
  const unit = certificateSyllabus.written.subjects.flatMap(s => s.units).find(u => u.id === 'secure-development')!
  expect(unit.lessons).toEqual([lesson.id])
  expect(lesson.originConceptIds).toEqual([])
  expect(certificateCatalog.get(lesson.id)).toEqual({ id: lesson.id, title: lesson.title, recall: lesson.recall, checklist: lesson.checklist })
  expect(previous).toHaveLength(17)
  for (const old of previous) {
    const current = certificateLessons.get(old.id)!
    expect({ id: current.id, domain: current.domain, checklist: current.checklist, originConceptIds: current.originConceptIds }).toEqual(old)
  }
  const at = new Date('2026-11-09T17:10:00.000Z')
  const entries = Object.fromEntries(previous.map(n => [n.id, {
    draft: 'Synthetic existing ' + n.id, checks: [...n.checklist], updatedAt: at.toISOString(), visitedAt: at.toISOString(),
  }]))
  const before = readCertificate(JSON.stringify({ version: 1, entries }))
  const added = changeCertificate(before, lesson.id, { kind: 'draft', text: 'Synthetic validation explanation', expected: '' }, at)
  for (const n of previous) expect(added.entries[n.id]).toEqual(before.entries[n.id])
  expect(() => changeCertificate(added, lesson.id, { kind: 'draft', text: 'Stale overwrite', expected: '' }, at)).toThrow()
  const restored = readCertificate(JSON.stringify(added))
  expect(mergeCertificate(restored, before).state).toEqual(added)
})
