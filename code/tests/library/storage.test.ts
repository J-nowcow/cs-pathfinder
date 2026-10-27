import { describe, it, expect } from 'vitest'
import {
  emptyLibrary,
  updateStudy,
  parseLibrary,
  mergeLibrary,
} from '@/lib/library/storage'
const meta = {
    title: '정규화',
    href: '/learn/engineer/normalization',
    track: 'engineer' as const,
  },
  at = '2026-10-27T16:00:00Z'
describe('새 학습 기록의 보존과 복습', () => {
  it('초안·체크를 수정해도 다른 필드와 처음 방문을 보존한다', () => {
    const a = updateStudy(
      emptyLibrary(),
      'topic:normalization',
      meta,
      { draft: '내 답', checks: ['키'] },
      at,
    )!
    const b = updateStudy(
      a,
      'topic:normalization',
      meta,
      { status: 'review' },
      '2026-10-28T01:00:00Z',
    )!
    expect(b.entries['topic:normalization']).toMatchObject({
      draft: '내 답',
      checks: ['키'],
      visitedAt: at,
      status: 'review',
      due: '2026-10-29',
    })
  })
  it('KST 자정과 자기 점검 간격을 사용하고 학습 중으로 바꾸면 예약을 푼다', () => {
    const a = updateStudy(
      emptyLibrary(),
      'topic:normalization',
      meta,
      { status: 'comfortable' },
      '2026-10-27T16:00:00Z',
    )!
    expect(a.entries['topic:normalization'].due).toBe('2026-10-31')
    expect(
      updateStudy(a, 'topic:normalization', meta, { status: 'learning' }, at)!
        .entries['topic:normalization'].due,
    ).toBeUndefined()
  })
  it('깨진 형식·실행 URL·외부 URL·과한 초안을 거절한다', () => {
    const a = updateStudy(emptyLibrary(), 'topic:normalization', meta, {}, at)!
    expect(parseLibrary('{')).toEqual(emptyLibrary())
    for (const href of [
      'javascript:alert(1)',
      'https://evil.test/',
      '//evil.test/',
      '/learn/engineer/../other',
    ]) {
      const v = structuredClone(a)
      v.entries['topic:normalization'].href = href
      expect(parseLibrary(JSON.stringify(v))).toEqual(emptyLibrary())
    }
    const v = structuredClone(a)
    v.entries['topic:normalization'].draft = 'x'.repeat(6001)
    expect(parseLibrary(JSON.stringify(v))).toEqual(emptyLibrary())
  })
  it('최신 충돌을 병합하고 기존 기록을 몰래 버리지 않는다', () => {
    const a = updateStudy(
      emptyLibrary(),
      'topic:normalization',
      meta,
      { draft: '이전' },
      at,
    )!
    const b = updateStudy(
      a,
      'topic:normalization',
      meta,
      { draft: '새 답' },
      '2026-10-28T01:00:00Z',
    )!
    expect(mergeLibrary(b, a)?.entries['topic:normalization'].draft).toBe(
      '새 답',
    )
    let full = emptyLibrary()
    for (let i = 0; i < 200; i++)
      full = updateStudy(full, 'topic:t-' + i, meta, {}, at)!
    expect(updateStudy(full, 'topic:new', meta, {}, at)).toBeNull()
    expect(Object.keys(full.entries)).toHaveLength(200)
    expect(
      updateStudy(full, 'topic:t-0', meta, { draft: '유지' }, at),
    ).not.toBeNull()
  })
})
