import { describe, it, expect } from 'vitest'
import { TOPIC_SEEDS } from '../../data/topic-seeds'
import { CATEGORIES } from '@/lib/tree/categories'

/**
 * 시드는 코드가 아니라 데이터라 리뷰에서 눈으로 훑고 넘어가기 쉽다.
 * 여기서 깨지는 것들은 전부 조용히 깨진다 — 에러 없이 화면만 이상해진다.
 */
describe('topic seeds', () => {
  /**
   * 분류가 어긋나면 게시판 탭이 빈다.
   *
   * 카테고리는 문자열로 비교된다. '자료구조 · 알고리즘'의 가운뎃점 주위 공백이
   * 하나만 달라도 필터에 안 걸리는데, 예외가 나지 않아서 그 탭이 그냥 빈 채로
   * 남는다. 아무도 그 탭을 안 누르면 몇 달을 모른다.
   */
  it('every seed lands in a known category', () => {
    const known = new Set<string>(CATEGORIES)
    const strays = [...new Set(TOPIC_SEEDS.map((s) => s.category))].filter((c) => !known.has(c))
    expect(strays).toEqual([])
  })

  /** 반대 방향. 시드가 없는 분류는 탭만 있고 영원히 안 나온다 */
  it('every category has seeds', () => {
    const used = new Set(TOPIC_SEEDS.map((s) => s.category))
    const empty = CATEGORIES.filter((c) => !used.has(c))
    expect(empty).toEqual([])
  })

  /**
   * 같은 주제어가 두 번 들어가면 같은 질문이 두 번 발행된다.
   *
   * 하루 하나씩 나가는 서비스에서 본 질문이 또 나오는 건 눈에 띄는 사고다.
   * 시드는 손으로 늘리는 데이터라 이 실수가 제일 나기 쉽다.
   */
  it('has no duplicate terms', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const s of TOPIC_SEEDS) {
      if (seen.has(s.term)) dupes.push(s.term)
      seen.add(s.term)
    }
    expect(dupes).toEqual([])
  })

  it('has no blank or untrimmed terms', () => {
    const bad = TOPIC_SEEDS.filter((s) => s.term.trim().length === 0 || s.term !== s.term.trim())
    expect(bad).toEqual([])
  })

  /**
   * 스펙 §4가 잡은 최소치다. 하루 하나면 13개월치.
   *
   * 소진되면 발행 API가 409를 주고 워크플로가 빨간불이 된다. 그때 급하게
   * 주제어를 짜내면 질이 떨어지므로 여유를 두고 채운다.
   */
  it('holds at least a year of questions', () => {
    expect(TOPIC_SEEDS.length).toBeGreaterThanOrEqual(400)
  })

  /**
   * 한 분류가 말라도 발행은 계속된다. claimSeed가 가장 오래 안 나온 분류를
   * 먼저 고르는데, 그 분류가 비어 있으면 다음 분류로 넘어가고 게시판이 한쪽으로
   * 기운다. 최소치를 두면 그런 쏠림이 늦게 온다.
   */
  it('keeps every category above a floor', () => {
    const counts = new Map<string, number>()
    for (const s of TOPIC_SEEDS) counts.set(s.category, (counts.get(s.category) ?? 0) + 1)
    const thin = CATEGORIES.filter((c) => (counts.get(c) ?? 0) < 30)
    expect(thin).toEqual([])
  })
})
