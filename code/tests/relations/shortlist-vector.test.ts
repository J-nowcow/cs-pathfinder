import { describe, it, expect } from 'vitest'
import { shortlist } from '@/lib/relations/shortlist'
import { EMBED_DIM, RELATION_MIN_SIMILARITY } from '@/lib/embed/model'

/**
 * **분야를 넘는 쌍이 낱말 방식에서는 아예 안 잡힌다.**
 *
 * 처음에 "낱말이 안 겹치면 후보에서 빠진다"고 적었다가 시험이 반박했다.
 * **같은 분야면 카테고리 가산점 1점이 붙어 `score === 0`을 안 지난다.**
 * 그러니 낱말 방식이 못 보는 것은 "낱말이 안 겹치는 쌍"이 아니라
 * **"낱말도 안 겹치고 분야도 다른 쌍"**이다.
 *
 * 하필 그것이 이 층을 만든 이유다. `shortlist` 주석이 그렇게 적어 뒀다 --
 * "네트워크와 모바일은 실제로 이어지는데, 카테고리 안에 가두면 그 선이
 * 영영 안 생긴다. 분야를 넘는 선을 만드는 것이 이 층을 만든 이유의 절반이다."
 * 절반을 만들려고 둔 장치가 정확히 그 절반을 막고 있었다.
 *
 * 여기 시험은 **벡터 분기를 지우면 깨져야 한다.**
 */
import { axis as vec } from '../helpers/axis'

const N = (id: string, question: string, category: string, deg?: number) => ({
  id,
  question,
  category,
  ...(deg === undefined ? {} : { embedding: vec(deg) }),
})

describe('벡터로 후보 추리기', () => {
  /** 이것이 이 변경의 전부다 */
  it('낱말도 안 겹치고 분야도 다른 쌍을 잡는다', () => {
    /* 겹치는 낱말이 0이어야 한다. `다시`가 양쪽에 있으면 점수가 1이 되어 안 빠진다 */
    const focus = N('f', 'TCP는 유실된 세그먼트를 어떻게 처리하는가?', '네트워크', 0)
    const retry = N('a', '모바일 앱에서 실패한 요청은 언제 재시도하는가?', '모바일', 5)

    /* 낱말로는 못 잡는 것을 먼저 확인한다. 아니면 이 시험이 아무것도 안 지킨다 */
    const byWord = shortlist({ ...focus, embedding: undefined }, [
      { ...retry, embedding: undefined },
    ])
    expect(byWord.map((c) => c.id)).toEqual([])

    expect(shortlist(focus, [retry]).map((c) => c.id)).toEqual(['a'])
  })

  /**
   * 같은 분야였다면 낱말 방식도 잡았다. 사각지대의 경계를 못 박아 둔다 --
   * 안 그러면 다음 사람이 "낱말 방식은 낱말이 안 겹치면 다 놓친다"고
   * 잘못 읽는다. 내가 그렇게 읽고 시험을 틀리게 썼다.
   */
  it('같은 분야면 낱말이 안 겹쳐도 낱말 방식이 이미 잡았다', () => {
    const focus = N('f', 'GC 멈춤은 왜 생기는가?', '언어 · 런타임')
    const stw = N('a', 'STW는 왜 필요한가?', '언어 · 런타임')

    expect(shortlist(focus, [stw]).map((c) => c.id)).toEqual(['a'])
  })

  it('가까운 순으로 준다', () => {
    const focus = N('f', '초점?', '네트워크', 0)
    const near = N('near', '가까움?', '네트워크', 5)
    const mid = N('mid', '중간?', '네트워크', 30)

    expect(shortlist(focus, [mid, near]).map((c) => c.id)).toEqual(['near', 'mid'])
  })

  /**
   * 문턱이 없으면 **모든 질문이 모든 질문의 후보**가 된다. 낱말 방식이
   * 불용어를 뺀 이유와 같은 문제다.
   */
  it('문턱보다 먼 것은 자른다', () => {
    const focus = N('f', '초점?', '네트워크', 0)
    /* cos 85° ≈ 0.09 */
    expect(shortlist(focus, [N('far', '먼 것?', '네트워크', 85)])).toEqual([])
  })

  it('상한을 지킨다', () => {
    const focus = N('f', '초점?', '네트워크', 0)
    const pool = Array.from({ length: 40 }, (_, i) => N(`n${i}`, `이웃 ${i}?`, '네트워크', i * 0.5))
    expect(shortlist(focus, pool, { limit: 5 })).toHaveLength(5)
  })

  it('자기 자신은 안 넣는다', () => {
    const focus = N('f', '초점?', '네트워크', 0)
    expect(shortlist(focus, [focus])).toEqual([])
  })

  /**
   * 새로 생긴 노드는 밤 배치 전까지 벡터가 없다. 그때 낱말 방식으로
   * 떨어져야 한다 — 못 이으면 이을 기회가 아예 없다.
   */
  it('초점에 벡터가 없으면 낱말 방식으로 떨어진다', () => {
    const focus = N('f', '인덱스는 언제 안 타는가?', '데이터베이스')
    const same = N('a', '인덱스가 왜 필요한가?', '데이터베이스', 0)

    expect(shortlist(focus, [same]).map((c) => c.id)).toEqual(['a'])
  })

  /** 벡터가 있는 것과 없는 것이 섞여도 터지지 않는다 */
  it('벡터 없는 노드가 섞여 있으면 건너뛴다', () => {
    const focus = N('f', '초점?', '네트워크', 0)
    const withVec = N('v', '벡터 있음?', '네트워크', 5)
    const without = N('n', '벡터 없음?', '네트워크')

    expect(shortlist(focus, [without, withVec]).map((c) => c.id)).toEqual(['v'])
  })

  /**
   * 관계는 "같은 것"이 아니라 "다르지만 이어지는 것"을 찾는다.
   * 매칭과 같은 문턱을 쓰면 중복만 잇고 만다.
   */
  it('관계 문턱이 매칭 문턱보다 낮다', async () => {
    const { EMBED_MIN_SIMILARITY } = await import('@/lib/embed/model')
    expect(RELATION_MIN_SIMILARITY).toBeLessThan(EMBED_MIN_SIMILARITY)
  })
})
