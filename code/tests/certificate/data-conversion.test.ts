import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { certificate, certificateLessons } from '@/lib/certificate/course'
import { certificateCatalog } from '@/lib/certificate/catalog'
import { certificateSyllabus } from '@/lib/certificate/syllabus'
import { changeCertificate, mergeCertificate, readCertificate } from '@/lib/certificate/storage'
import previous from './fixtures/pre-conversion-identities.json'

const lesson = certificateLessons.get('data-conversion-reconciliation')!

it('executes the displayed readonly transformation and reconciles each source identity and held reason', async () => {
  const db = new PGlite()
  try {
    expect(lesson.example.code).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i)
    expect(Math.max(...lesson.example.code!.split('\n').map(line => line.length))).toBeLessThanOrEqual(75)
    const result = await db.query<Record<string, unknown>>(lesson.example.code!)
    expect(result.rows.map(row => lesson.example.headers!.map(h => row[h]))).toEqual(lesson.example.rows)
    expect(result.rows.map(row => row.source_id)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'])
    expect(new Set(result.rows.map(row => row.source_id)).size).toBe(8)
    const ready = result.rows.filter(row => row.state === 'ready')
    const held = result.rows.filter(row => String(row.state).startsWith('held:'))
    expect([result.rows.length, ready.length, held.length]).toEqual([8, 3, 5])
    expect(ready.reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(19)
    expect(held.every(row => row.quantity === null && row.zone === null)).toBe(true)
    expect(result.rows.find(row => row.source_id === 'S02')).toMatchObject({ raw_qty: '0', quantity: 0, zone: null, state: 'ready' })
    expect(result.rows.find(row => row.source_id === 'S07')).toMatchObject({ raw_qty: null, state: 'held:required' })
  } finally { await db.close() }
})

it('checks the exact conversion expressions with separately specified valid, invalid and missing values', async () => {
  const db = new PGlite()
  try {
    const tail = lesson.example.code!.slice(lesson.example.code!.indexOf('), normalized AS ('))
    const query = "WITH raw(source_id, raw_qty, raw_zone) AS (\nSELECT 'probe'::text, $1::text, $2::text\n" + tail
    const cases: [string | null, string | null, number | null, string | null, string][] = [
      ['999999', 'F', 999999, 'F', 'ready'],
      ['000000', null, 0, null, 'ready'],
      [' 7 ', ' a ', 7, 'A', 'ready'],
      ['0000000', 'a', null, null, 'held:qty'],
      ['-1', 'a', null, null, 'held:qty'],
      ['+7', 'a', null, null, 'held:qty'],
      ['1e2', 'a', null, null, 'held:qty'],
      ['7\t', 'a', null, null, 'held:qty'],
      ['7\n', 'a', null, null, 'held:qty'],
      ['７', 'a', null, null, 'held:qty'],
      ['', 'a', null, null, 'held:required'],
      [null, 'a', null, null, 'held:required'],
      ['7', 'AA', null, null, 'held:zone'],
      ['7', 'g', null, null, 'held:zone'],
      ['7', '\t', null, null, 'held:zone'],
    ]
    for (const [rawQty, rawZone, quantity, zone, state] of cases) {
      const result = await db.query(query, [rawQty, rawZone])
      expect(result.rows, JSON.stringify([rawQty, rawZone])).toEqual([{ source_id: 'probe', raw_qty: rawQty, raw_zone: rawZone, quantity, zone, state }])
    }
  } finally { await db.close() }
})

it('keeps all eighteen historical contracts while adding only a partial conversion lesson and record', () => {
  expect(previous).toHaveLength(18)
  for (const old of previous) {
    const current = certificateLessons.get(old.id)!
    expect({ id: current.id, domain: current.domain, checklist: current.checklist, originConceptIds: current.originConceptIds }).toEqual(old)
  }
  const unit = certificateSyllabus.written.subjects.flatMap(s => s.units).find(u => u.id === 'conversion')!
  expect(unit.lessons).toEqual([lesson.id])
  expect(certificateCatalog.get(lesson.id)).toEqual({ id: lesson.id, title: lesson.title, recall: lesson.recall, checklist: lesson.checklist })
  expect(lesson.originConceptIds).toEqual([])
  expect(certificate.lessons.filter(n => n.domain === 'db-sql')).toHaveLength(12)
  const at = new Date('2026-11-09T18:10:00.000Z')
  const entries = Object.fromEntries(previous.map(n => [n.id, {
    draft: 'Synthetic previous ' + n.id, checks: [...n.checklist], visitedAt: at.toISOString(), updatedAt: at.toISOString(),
  }]))
  const before = readCertificate(JSON.stringify({ version: 1, entries }))
  const next = changeCertificate(before, lesson.id, { kind: 'draft', text: 'Synthetic reconciliation explanation', expected: '' }, at)
  for (const old of previous) expect(next.entries[old.id]).toEqual(before.entries[old.id])
  expect(() => changeCertificate(next, lesson.id, { kind: 'draft', text: 'Stale change', expected: '' }, at)).toThrow()
  expect(mergeCertificate(readCertificate(JSON.stringify(next)), before).state).toEqual(next)
})
