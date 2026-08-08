import { describe, it, expect } from 'vitest'
import { suggestNext, type Candidate } from '@/lib/streak/suggest'

const c = (n: number, category: string): Candidate => ({
  id: `id${n}`,
  number: n,
  question: `질문 ${n}`,
  category,
})

const ALL = [
  c(1, '네트워크'),
  c(2, '네트워크'),
  c(3, '네트워크'),
  c(4, '운영체제'),
  c(5, '운영체제'),
  c(6, '데이터베이스'),
  c(7, '모바일'),
]

describe('다음에 팔 것', () => {
  it('이미 판 것은 안 준다', () => {
    const out = suggestNext(ALL, new Set(['id1', 'id2']), ['네트워크', '네트워크'], 5)
    expect(out.map((x) => x.id)).not.toContain('id1')
    expect(out.map((x) => x.id)).not.toContain('id2')
  })

  it('많이 판 분야를 먼저 준다', () => {
    const out = suggestNext(ALL, new Set(['id1']), ['네트워크'], 2)
    expect(out[0].category).toBe('네트워크')
  })

  /*
   * 이것이 없으면 처음 고른 분야에 영영 갇힌다. 네트워크만 판 사람에게
   * 네트워크만 계속 주면 추천이 아니라 메아리다.
   */
  it('안 가 본 분야를 하나는 섞는다', () => {
    const out = suggestNext(ALL, new Set(['id1']), ['네트워크'], 3)
    const categories = new Set(out.map((x) => x.category))
    expect(categories.size).toBeGreaterThan(1)
  })

  it('처음 온 사람에게도 준다', () => {
    const out = suggestNext(ALL, new Set(), [], 3)
    expect(out.length).toBe(3)
  })

  it('다 팠으면 빈 목록이다', () => {
    const out = suggestNext(ALL, new Set(ALL.map((x) => x.id)), ['네트워크'], 5)
    expect(out).toEqual([])
  })

  it('같은 것을 두 번 주지 않는다', () => {
    const out = suggestNext(ALL, new Set(), ['네트워크'], 5)
    expect(new Set(out.map((x) => x.id)).size).toBe(out.length)
  })

  /* 새로고침마다 추천이 바뀌면 "아까 그거 뭐였지"가 안 된다 */
  it('같은 입력이면 같은 순서를 낸다', () => {
    const a = suggestNext(ALL, new Set(['id1']), ['네트워크', '운영체제'], 4)
    const b = suggestNext(ALL, new Set(['id1']), ['네트워크', '운영체제'], 4)
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id))
  })

  it('요청한 개수를 넘지 않는다', () => {
    expect(suggestNext(ALL, new Set(), ['네트워크'], 2).length).toBe(2)
  })
})
