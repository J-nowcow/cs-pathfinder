import { describe, expect, it } from 'vitest'
import { CASE_STORAGE_KEY, changeRoleRecord, emptySession, parseSession, persistSession, reviewDate } from '@/lib/cases/storage'
import { roles, translations } from '@/lib/cases/content'

describe('case record boundaries', () => {
  it('keeps role drafts separate and rejects incomplete progress', () => {
    const changed = changeRoleRecord(emptySession(), 'developer', { draft: 'A hypothesis' })
    expect(parseSession(JSON.stringify(changed)).records.project.draft).toBe('')
    changed.records.developer.stage = 2
    expect(() => parseSession(JSON.stringify(changed))).toThrow()
  })
  it('does not overwrite unreadable or incompatible records', () => {
    for (const raw of ['{broken', JSON.stringify({ ...emptySession(), contentVersion: 99 })]) {
      let written = false
      expect(() => persistSession({ getItem: () => raw, setItem: () => { written = true } }, emptySession(), raw)).toThrow()
      expect(written).toBe(false)
    }
  })
  it('refuses a changed record from another tab', () => {
    let written = false
    const remote = JSON.stringify(changeRoleRecord(emptySession(), 'project', { draft: 'Other tab' }))
    expect(() => persistSession({ getItem: () => remote, setItem: () => { written = true } }, emptySession(), null)).toThrow('CASE_CONFLICT')
    expect(written).toBe(false)
  })
  it('uses the last saved value for consecutive saves, without touching other keys', () => {
    const data = new Map<string, string>([['pathfinder.library.v1', 'existing library']])
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
    const first = persistSession(storage, emptySession(), null)
    const changed = changeRoleRecord(emptySession(), 'product', { draft: 'A user task' })
    persistSession(storage, changed, first)
    expect(parseSession(data.get(CASE_STORAGE_KEY)!).records.product.draft).toBe('A user task')
    expect(data.get('pathfinder.library.v1')).toBe('existing library')
  })
  it('schedules actual instants across month boundaries, without claiming an optimal interval', () => {
    expect(reviewDate(3, new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-03T23:30:00.000Z')
  })
  it('keeps the same evidence IDs and check positions across translations', () => {
    expect(translations.ko.facts.map(value => value.slice(0, 2))).toEqual(translations.en.facts.map(value => value.slice(0, 2)))
    for (const role of roles) {
      expect(translations.ko.roles[role].checks).toHaveLength(translations.en.roles[role].checks.length)
      expect(translations.ko.roles[role].transferChecks).toHaveLength(translations.en.roles[role].transferChecks.length)
    }
  })
})
