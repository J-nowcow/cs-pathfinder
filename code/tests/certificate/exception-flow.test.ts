import { expect, it } from 'vitest'
import { certificate, certificateLessons } from '@/lib/certificate/course'
import { certificateSyllabus } from '@/lib/certificate/syllabus'
import { certificateCatalog } from '@/lib/certificate/catalog'
import { changeCertificate, mergeCertificate, readCertificate } from '@/lib/certificate/storage'
import previous from './fixtures/pre-exception-identities.json'

const lesson = certificateLessons.get('synchronous-exception-flow')!
const makeFunction = (code = lesson.example.code!) => new Function(
  code + '\nreturn traceReservation;',
)() as (mode: string, trace: string[]) => string
const observe = (fn: ReturnType<typeof makeFunction>, mode: string) => {
  const trace: string[] = []
  try {
    return [mode, trace, fn(mode, trace)] as const
  } catch (error) {
    return [mode, trace, (error as Error).name] as const
  }
}

it('runs the exact displayed synchronous code and distinguishes return from propagated errors', () => {
  const fn = makeFunction()
  expect(Math.max(...lesson.example.code!.split('\n').map(line => line.length))).toBeLessThanOrEqual(75)
  const cases: [string, string[], string][] = [
    ['open', ['try', 'accepted', 'finally', 'after'], 'completed'],
    ['full', ['try', 'catch', 'handled', 'finally', 'after'], 'completed'],
    ['broken', ['try', 'catch', 'finally'], 'TypeError'],
  ]
  for (const [mode, trace, result] of cases) {
    expect(observe(fn, mode)).toEqual([mode, trace, result])
  }
  expect(cases.map(([mode, trace, result]) => [
    mode, trace.join(' → '), result === 'completed' ? 'completed 반환' : `${result}를 호출자로 전파`,
  ])).toEqual(lesson.example.rows)
  const trace: string[] = []
  expect(() => fn('broken', trace)).toThrow(TypeError)
  expect(trace).toEqual(['try', 'catch', 'finally'])
})

it('verifies the changed-type recall and the stated finally override caution independently', () => {
  const changed = makeFunction(lesson.example.code!.replace('instanceof RangeError', 'instanceof TypeError'))
  expect(observe(changed, 'full')).toEqual(['full', ['try', 'catch', 'finally'], 'RangeError'])
  expect(observe(changed, 'broken')).toEqual(['broken', ['try', 'catch', 'handled', 'finally', 'after'], 'completed'])
  expect(observe(changed, 'open')).toEqual(['open', ['try', 'accepted', 'finally', 'after'], 'completed'])
  const returnWins = new Function('try { throw new TypeError("synthetic"); } finally { return "override"; }')
  expect(returnWins()).toBe('override')
  const throwWins = new Function('try { return "original"; } finally { throw new RangeError("synthetic"); }')
  expect(throwWins).toThrow(RangeError)
})

it('keeps the fixed nineteen historical identities and records while adding only one partial language lesson', () => {
  expect(previous).toHaveLength(19)
  for (const old of previous) {
    const current = certificateLessons.get(old.id)!
    expect({ id: current.id, domain: current.domain, checklist: current.checklist, originConceptIds: current.originConceptIds }).toEqual(old)
  }
  const unit = certificateSyllabus.written.subjects.flatMap(s => s.units).find(u => u.id === 'languages')!
  expect(unit.lessons).toEqual([lesson.id])
  expect(certificateCatalog.get(lesson.id)).toEqual({ id: lesson.id, title: lesson.title, recall: lesson.recall, checklist: lesson.checklist })
  expect(certificate.lessons).toHaveLength(20)
  expect(certificate.scope).toContain(`${certificate.lessons.length}수업`)
  expect(certificateSyllabus.coverageNotice).toContain(`${certificate.lessons.length}개 수업`)
  expect(lesson.originConceptIds).toEqual([])
  const at = new Date('2026-11-09T21:05:00.000Z')
  const entries = Object.fromEntries(previous.map(old => [old.id, {
    draft: 'Synthetic previous ' + old.id, checks: [...old.checklist], visitedAt: at.toISOString(), updatedAt: at.toISOString(),
  }]))
  const before = readCertificate(JSON.stringify({ version: 1, entries }))
  const next = changeCertificate(before, lesson.id, { kind: 'draft', text: 'Synthetic exception explanation', expected: '' }, at)
  for (const old of previous) expect(next.entries[old.id]).toEqual(before.entries[old.id])
  expect(() => changeCertificate(next, lesson.id, { kind: 'draft', text: 'Stale', expected: '' }, at)).toThrow()
  expect(mergeCertificate(readCertificate(JSON.stringify(next)), before).state).toEqual(next)
})
