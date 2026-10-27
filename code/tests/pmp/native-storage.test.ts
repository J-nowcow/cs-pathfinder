import { describe, it, expect } from 'vitest'
import { changePmp, readPmp, savePmp, PMP_KEY } from '@/lib/pmp/storage'
import { pmpQuestions } from '@/lib/pmp/questions'
const at = '2026-10-27T12:00:00Z',
  now = new Date('2026-10-27T16:00:00Z')
describe('기존 PMP 백업 형식 보존', () => {
  it('notes change preserves unknown fields, case answers, bookmarks, preferences and other lesson notes', () => {
    const legacy = readPmp(
      JSON.stringify({
        version: 1,
        notes: { n01: '원래 메모', n02: '다른 수업' },
        thoughts: { n02: '다른 생각' },
        answers: { c1q1: { index: 1, correct: false, at } },
        prefs: { theme: 'dark', font: 'batang' },
        bookmarks: ['n02'],
        future: { keep: true },
      }),
    )
    const next = changePmp(
      legacy,
      {
        kind: 'text',
        id: 'n01',
        field: 'notes',
        text: '새 메모',
        expected: '원래 메모',
      },
      now,
    )
    expect(next).toEqual({
      ...legacy,
      notes: { n01: '새 메모', n02: '다른 수업' },
    })
    expect(legacy.notes).toEqual({ n01: '원래 메모', n02: '다른 수업' })
  })
  it("re-reads storage before writing and preserves another tab's edit; conflicting same-field edits are refused", () => {
    let raw = JSON.stringify({
      version: 1,
      notes: { n01: '원래', n02: '다른 탭 새 메모' },
    })
    const store = {
      getItem: () => raw,
      setItem: (_k: string, v: string) => {
        raw = v
      },
    }
    savePmp(store, {
      kind: 'text',
      id: 'n01',
      field: 'notes',
      text: '새 글',
      expected: '원래',
    })
    expect(JSON.parse(raw).notes.n02).toBe('다른 탭 새 메모')
    const before = raw
    expect(() =>
      savePmp(store, {
        kind: 'text',
        id: 'n01',
        field: 'notes',
        text: '오래된 글',
        expected: '원래',
      }),
    ).toThrow('다른 탭')
    expect(raw).toBe(before)
  })
  it('corrupt or unknown-version storage is not silently reset or replaced', () => {
    expect(() => readPmp('{')).toThrow()
    expect(() => readPmp('{"version":2}')).toThrow()
    expect(() =>
      changePmp(readPmp('{"version":1,"notes":"broken"}'), {
        kind: 'text',
        id: 'n01',
        field: 'notes',
        text: 'x',
        expected: '',
      }),
    ).toThrow()
  })
  it('records native visits, real selected-option correctness and legacy-shaped review dates', () => {
    let s = changePmp({ version: 1 }, { kind: 'visit', id: 'n01' }, now)
    expect(s.seen).toEqual({ n01: now.toISOString() })
    const wrong = pmpQuestions.get('n01')!.options.findIndex((x) => !x.correct)
    s = changePmp(s, { kind: 'answer', id: 'n01', index: wrong }, now)
    expect(s.answers).toEqual({
      n01: { index: wrong, correct: false, at: now.toISOString() },
    })
    s = changePmp(s, { kind: 'rating', id: 'n01', rating: 'good' }, now)
    expect(s.review).toEqual({
      n01: { due: '2026-10-30T16:00:00.000Z', interval: 3, rating: 'good' },
    })
    expect(PMP_KEY).toBe('pmp-pathfinder-v1')
  })
})
