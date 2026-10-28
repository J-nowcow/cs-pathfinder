import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../learning-content/certificate/course.json', () => {
  throw new Error('Full certificate lesson bodies reached the client record path')
})
import { certificateCatalog } from '@/lib/certificate/catalog'
import { certificateHref } from '@/lib/certificate/routes'
import { readCertificate, changeCertificate, CERTIFICATE_KEY } from '@/lib/certificate/storage'
import { readLibraryProgress } from '@/lib/library/progress'

const source: { lessons: { id: string; title: string; recall: string; checklist: string[] }[] } = JSON.parse(
  readFileSync(new URL('../../learning-content/certificate/course.json', import.meta.url), 'utf8'),
)
const now = new Date('2026-10-28T14:59:59.000Z')

describe('certificate client catalog boundary', () => {
  it('keeps every exact authored title, recall prompt and persisted checklist key without full explanations', () => {
    expect(certificateCatalog.size).toBe(16)
    expect([...certificateCatalog.values()]).toEqual(source.lessons.map(n => ({
      id: n.id, title: n.title, recall: n.recall, checklist: n.checklist,
    })))
    expect(certificateHref('space / value')).toBe('/learn/certificate/space%20%2F%20value')
  })

  it('restores and edits all16 legacy records/checklists while retaining other lessons and KST review boundaries', () => {
    const entries = Object.fromEntries(source.lessons.map(n => [n.id, {
      draft: 'Synthetic ' + n.id, checks: [...n.checklist], visitedAt: now.toISOString(), updatedAt: now.toISOString(), due: '2026-10-29',
    }]))
    const original = readCertificate(JSON.stringify({ version: 1, entries }))
    expect(original.entries).toEqual(entries)
    for (const n of source.lessons) {
      for (const value of n.checklist) {
        const unchecked = changeCertificate(original, n.id, { kind: 'check', value, checked: false }, now)
        expect(unchecked.entries[n.id].checks).toEqual(n.checklist.filter(x => x !== value))
        const restored = changeCertificate(unchecked, n.id, { kind: 'check', value, checked: true }, now)
        expect(new Set(restored.entries[n.id].checks)).toEqual(new Set(n.checklist))
        expect(() => changeCertificate(original, n.id, { kind: 'check', value: value + ' ', checked: true }, now)).toThrow()
      }
      const old = JSON.stringify(original)
      expect(() => changeCertificate(original, n.id, { kind: 'draft', text: 'Stale overwrite', expected: '' }, now)).toThrow()
      expect(JSON.stringify(original)).toBe(old)
      const beforeMidnight = changeCertificate(original, n.id, { kind: 'review', interval: 1 }, now)
      const afterMidnight = changeCertificate(original, n.id, { kind: 'review', interval: 1 }, new Date('2026-10-28T15:00:00.000Z'))
      expect(beforeMidnight.entries[n.id].due).toBe('2026-10-29')
      expect(afterMidnight.entries[n.id].due).toBe('2026-10-30')
      expect(Object.keys(afterMidnight.entries)).toHaveLength(16)
    }
  })

  it('builds the same complete private shelf titles/links without importing server course bodies and rejects unknown identities', () => {
    const entries = Object.fromEntries(source.lessons.map(n => [n.id, {
      draft: 'Synthetic ' + n.id, checks: [...n.checklist], visitedAt: now.toISOString(), updatedAt: now.toISOString(),
    }]))
    const progress = readLibraryProgress({ getItem: key => key === CERTIFICATE_KEY ? JSON.stringify({ version: 1, entries }) : null }, now)
    const items = progress.recent.filter(n => n.id.startsWith('certificate:'))
    expect(items).toHaveLength(16)
    for (const n of source.lessons) expect(items.find(x => x.id === 'certificate:' + n.id)).toMatchObject({ title: n.title, href: certificateHref(n.id) })
    expect(() => readCertificate(JSON.stringify({ version: 1, entries: { unknown: entries[source.lessons[0].id] } }))).toThrow()
    const forged = structuredClone(entries)
    forged[source.lessons[0].id].checks = ['Unknown checklist value']
    expect(() => readCertificate(JSON.stringify({ version: 1, entries: forged }))).toThrow()
  })
})
