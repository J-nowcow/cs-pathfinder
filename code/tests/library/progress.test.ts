import { describe, it, expect } from 'vitest'
import { readLibraryProgress } from '@/lib/library/progress'
import { emptyLibrary, updateStudy, LIBRARY_KEY } from '@/lib/library/storage'
const now = new Date('2026-10-27T02:00:00Z')
describe('기존 학습 기록을 덮어쓰지 않는 통합 보기', () => {
  it('저장소를 읽기만 하고 분야의 서로 다른 단위를 유지한다', () => {
    const raw: Record<string, string> = {
      'pmp-pathfinder-v1': JSON.stringify({
        version: 1,
        seen: { n69: '2026-10-26T01:00:00Z' },
        review: { n69: { due: '2026-10-26T02:00:00Z' } },
      }),
      'jira-garden-v1': JSON.stringify({
        done: [1, 1, 2, 11, '3'],
        solved: [1, 20, 21],
        last: 3,
      }),
      'csqt.journey.v1': JSON.stringify({
        version: 1,
        currentId: 'a',
        occurrences: [
          {
            id: 'a',
            nodeId: 'abc',
            parentId: null,
            question: '왜?',
            category: 'DB',
          },
        ],
      }),
    }
    const before = JSON.stringify(raw)
    const v = readLibraryProgress({ getItem: (k) => raw[k] ?? null }, now)
    expect(JSON.stringify(raw)).toBe(before)
    expect(v.cards.find((x) => x.id === 'pmp')?.metrics[0][1]).toBe(1)
    expect(v.cards.find((x) => x.id === 'jira')?.metrics).toEqual([
      ['완료 표시한 수업', 2],
      ['맞힌 JQL', 2],
      ['실무 미션 기록', 0],
    ])
    expect(v.cards[0].href).toBe('/q/abc')
    expect(v.due[0].title).toContain('편익')
    expect(v.recent.find((x) => x.track === 'CS')?.at).toBeNull()
  })
  it('기술사와 미션의 복습을 기존 PMP와 같은 대기열로 읽는다', () => {
    const state = updateStudy(
      emptyLibrary(),
      'mission:scope',
      { title: '작업 분해', href: '/learn/jira#scope', track: 'jira' },
      { status: 'review' },
      '2026-10-25T01:00:00Z',
    )!
    const v = readLibraryProgress(
      { getItem: (k) => (k === LIBRARY_KEY ? JSON.stringify(state) : null) },
      now,
    )
    expect(v.due).toHaveLength(1)
    expect(v.due[0].href).toBe('/learn/jira#scope')
    expect(v.missionCount).toBe(1)
    expect(v.cards.find((x) => x.id === 'jira')?.href).toBe('/learn/jira#scope')
  })
  it('저장소 차단과 손상 JSON에서도 화면용 기본값을 돌려준다', () => {
    expect(
      readLibraryProgress(
        {
          getItem: () => {
            throw Error('blocked')
          },
        },
        now,
      ).unavailable,
    ).toBe(true)
    expect(
      readLibraryProgress({ getItem: () => '{bad' }, now).cards,
    ).toHaveLength(5)
  })
})
