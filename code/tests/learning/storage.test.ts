import { describe, expect, it } from 'vitest'
import { deserializeDailySession } from '@/lib/learning/storage'

const valid = {
  date: '2026-08-14',
  trackId: 'backend',
  createdAt: '2026-08-14T00:00:00.000Z',
  items: [{ kind: 'new', questionId: 'q1', question: '질문', reason: '새 질문' }],
}

describe('오늘 학습 스냅샷 복원', () => {
  it('올바른 스냅샷을 복원한다', () => {
    expect(deserializeDailySession(JSON.stringify(valid))).toEqual(valid)
  })

  it('깨진 JSON과 잘못된 날짜를 거부한다', () => {
    expect(deserializeDailySession('{깨짐')).toBeNull()
    expect(deserializeDailySession(JSON.stringify({ ...valid, date: '8월 14일' }))).toBeNull()
  })

  it('세 문제를 넘거나 같은 질문이 중복된 스냅샷을 거부한다', () => {
    expect(deserializeDailySession(JSON.stringify({ ...valid, items: Array(4).fill(valid.items[0]) }))).toBeNull()
    expect(deserializeDailySession(JSON.stringify({ ...valid, items: [valid.items[0], valid.items[0]] }))).toBeNull()
  })

  it('질문과 이유의 길이를 제한한다', () => {
    expect(deserializeDailySession(JSON.stringify({
      ...valid,
      items: [{ ...valid.items[0], question: 'x'.repeat(501) }],
    }))).toBeNull()
  })
})
