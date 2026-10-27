import { describe, expect, it } from 'vitest'
import {
  editLibrary,
  readLibraryStrict,
  restoreLibraryStrict,
} from '@/lib/library/local-edit'
import { LIBRARY_KEY, emptyLibrary, mergeLibrary } from '@/lib/library/storage'
import { canonicalLibraryJson } from '@/lib/library/account-schema'
import { readLibraryProgress } from '@/lib/library/progress'
const meta = {
  title: 'Normal forms',
  href: '/learn/engineer/normalization',
  track: 'engineer' as const,
}
const id = 'topic:normalization',
  at = '2026-10-28T00:00:00Z'
function store(raw: string | null = null) {
  const data = new Map<string, string>()
  if (raw !== null) data.set(LIBRARY_KEY, raw)
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}
describe('strict local library editing', () => {
  it('preserves a competing draft and merges a fresh check without restoring stale fields', () => {
    const s = store()
    editLibrary(
      s,
      id,
      meta,
      { kind: 'draft', text: 'Original', expected: '' },
      at,
    )
    editLibrary(
      s,
      id,
      meta,
      { kind: 'draft', text: 'Other tab', expected: 'Original' },
      at,
    )
    expect(() =>
      editLibrary(
        s,
        id,
        meta,
        { kind: 'draft', text: 'My edit', expected: 'Original' },
        at,
      ),
    ).toThrow('conflict')
    editLibrary(
      s,
      id,
      meta,
      { kind: 'check', value: 'First', checked: true },
      at,
    )
    editLibrary(
      s,
      id,
      meta,
      { kind: 'check', value: 'Second', checked: true },
      at,
    )
    expect(readLibraryStrict(s).entries[id]).toMatchObject({
      draft: 'Other tab',
      checks: ['First', 'Second'],
    })
  })
  it('refuses malformed, future or partially invalid state without writing over raw bytes', () => {
    for (const raw of [
      '{',
      '',
      JSON.stringify({ version: 2, entries: {} }),
      JSON.stringify({ version: 1, entries: { invalid: {} } }),
      JSON.stringify({ version: 1, entries: {}, future: true }),
    ]) {
      const s = store(raw)
      expect(() => editLibrary(s, id, meta, { kind: 'visit' }, at)).toThrow(
        'format',
      )
      expect(s.getItem(LIBRARY_KEY)).toBe(raw)
      expect(readLibraryProgress(s).unavailable).toBe(true)
    }
  })
  it('rejects unavailable storage and a change observed just before the write', () => {
    const s = store()
    let count = 0
    const raced = {
      ...s,
      getItem: (key: string) => {
        count++
        if (count === 2) s.setItem(key, JSON.stringify(emptyLibrary()))
        return s.getItem(key)
      },
    }
    expect(() => editLibrary(raced, id, meta, { kind: 'visit' }, at)).toThrow(
      'conflict',
    )
    expect(readLibraryStrict(s)).toEqual(emptyLibrary())
    expect(() =>
      readLibraryStrict({
        getItem() {
          throw Error('denied')
        },
      }),
    ).toThrow('read')
    expect(() =>
      editLibrary(
        {
          ...s,
          setItem() {
            throw Error('quota')
          },
        },
        id,
        meta,
        { kind: 'draft', text: 'Keep input', expected: '' },
        at,
      ),
    ).toThrow('write')
    expect(readLibraryStrict(s)).toEqual(emptyLibrary())
  })
  it('visiting preserves edit/review timestamps while updating common resume order', () => {
    const s = store()
    editLibrary(
      s,
      id,
      meta,
      { kind: 'draft', text: 'My note', expected: '' },
      at,
    )
    editLibrary(s, id, meta, { kind: 'review', status: 'comfortable' }, at)
    const before = readLibraryStrict(s).entries[id]
    editLibrary(s, id, meta, { kind: 'visit' }, '2026-10-29T00:00:00Z')
    expect(readLibraryStrict(s).entries[id]).toMatchObject({
      draft: before.draft,
      due: before.due,
      updatedAt: before.updatedAt,
      visitedAt: '2026-10-29T00:00:00Z',
    })
    expect(readLibraryProgress(s).recent[0].at).toBe('2026-10-29T00:00:00Z')
  })
  it('restores compatible backups but refuses different nonempty drafts atomically', () => {
    const s = store()
    const original = editLibrary(
      s,
      id,
      meta,
      { kind: 'draft', text: 'Local', expected: '' },
      at,
    )
    const conflict = structuredClone(original)
    conflict.entries[id].draft = 'Backup'
    const raw = s.getItem(LIBRARY_KEY)
    expect(() => restoreLibraryStrict(s, conflict)).toThrow('conflict')
    expect(s.getItem(LIBRARY_KEY)).toBe(raw)
    const same = structuredClone(original)
    same.entries[id].updatedAt = '2026-10-29T00:00:00Z'
    same.entries[id].checks = ['New check']
    expect(restoreLibraryStrict(s, same).entries[id].checks).toEqual([
      'New check',
    ])
    const blank = structuredClone(same)
    blank.entries[id].draft = ''
    blank.entries[id].updatedAt = '2026-10-30T00:00:00Z'
    expect(mergeLibrary(original, blank)?.entries[id].draft).toBe('Local')
  })
  it('serializes optional undefined fields like JSON and keeps stable ordering', () => {
    expect(
      canonicalLibraryJson({ b: 1, due: undefined, a: [undefined, 'x'] }),
    ).toBe('{"a":[null,"x"],"b":1}')
  })
})
