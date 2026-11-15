import { describe, expect, it } from 'vitest'
import { certificate, certificateDomain, certificateLessons } from '@/lib/certificate/course'
import { certificateCatalog } from '@/lib/certificate/catalog'
import { certificateSyllabus } from '@/lib/certificate/syllabus'
import { learningPage } from '@/lib/seo/learning'
import { changeCertificate, mergeCertificate, readCertificate } from '@/lib/certificate/storage'
import legacy from './fixtures/legacy-identities.json'

describe('requirements lesson integration and retained records', () => {
  it('keeps all 16 legacy identities/checklist keys and links one original lesson to the partial unit', () => {
    expect(legacy).toHaveLength(16)
    for (const old of legacy) {
      const current = certificateLessons.get(old.id)!
      expect({ id: current.id, domain: current.domain, checklist: current.checklist, originConceptIds: current.originConceptIds }).toEqual(old)
    }
    const lesson = certificateLessons.get('requirements-traceability')!
    expect(certificateDomain(lesson)).toBe('요구사항 확인 기초')
    const unit = certificateSyllabus.written.subjects.flatMap(s => s.units).find(u => u.id === 'requirements')!
    expect(unit.lessons).toEqual([lesson.id])
    expect(lesson.originConceptIds).toEqual([])
    expect(certificateCatalog.get(lesson.id)).toEqual({ id: lesson.id, title: lesson.title, recall: lesson.recall, checklist: lesson.checklist })
    expect(learningPage('/learn/certificate/' + lesson.id)?.description).toBe(lesson.lead)
    expect(lesson.example.verification).toContain('실행 결과 없음')
    expect(lesson.example.rows!.every(row => row[3] === '미실행')).toBe(true)
    expect(certificate.lessons.filter(n => n.domain === 'db-sql')).toHaveLength(12)
  })

  it('adds a new lesson record without deleting legacy drafts or weakening conflict protection', () => {
    const at = new Date('2026-11-09T16:45:00.000Z')
    const oldEntries = Object.fromEntries(legacy.map(n => [n.id, {
      draft: 'Synthetic preserved ' + n.id, checks: [...n.checklist], updatedAt: at.toISOString(), visitedAt: at.toISOString(),
    }]))
    const before = readCertificate(JSON.stringify({ version: 1, entries: oldEntries }))
    const withNew = changeCertificate(before, 'requirements-traceability', { kind: 'draft', text: 'Synthetic new explanation', expected: '' }, at)
    for (const old of legacy) expect(withNew.entries[old.id]).toEqual(before.entries[old.id])
    expect(() => changeCertificate(withNew, 'requirements-traceability', { kind: 'draft', text: 'Stale overwrite', expected: '' }, at)).toThrow()
    const restored = readCertificate(JSON.stringify(withNew))
    expect(restored).toEqual(withNew)
    expect(mergeCertificate(restored, before).state.entries).toEqual(withNew.entries)
  })
})
