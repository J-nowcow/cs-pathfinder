import { describe, it, expect } from 'vitest'
import { nextPace } from '@/lib/relations/pace'

/**
 * 한도에 막혔을 때 어떻게 할지 정한다.
 *
 * 실측에서 나온 문제다. gemma 한도에 걸리자 스크립트가 남은 질문 102개를
 * 순식간에 전부 실패로 태웠다. 성공은 1개였다. 재시도를 끄면서 실패가 빨라진
 * 것이 역효과가 났다 — 예전엔 느려서 저절로 쉬어갔다.
 *
 * 막히면 쉬고, 쉬어도 안 되면 그만둔다. 목록을 태우는 것이 제일 나쁘다.
 */
describe('nextPace', () => {
  it('moves on with no wait while things work', () => {
    expect(nextPace({ consecutiveFailures: 0 })).toMatchObject({ waitMs: 0, stop: false })
  })

  /* 분당 한도는 기다리면 풀린다. 첫 실패에 그만두면 될 것도 안 된다 */
  it('waits after the first failure', () => {
    const p = nextPace({ consecutiveFailures: 1 })
    expect(p.stop).toBe(false)
    expect(p.waitMs).toBeGreaterThanOrEqual(30_000)
  })

  /* 계속 막히면 더 오래 쉰다. 같은 간격으로 두드리면 한도를 계속 먹는다 */
  it('waits longer as failures pile up', () => {
    expect(nextPace({ consecutiveFailures: 3 }).waitMs).toBeGreaterThan(
      nextPace({ consecutiveFailures: 1 }).waitMs,
    )
  })

  /* 기다림에도 상한이 있다. 무한정 늘면 사람이 멈춘 줄 안다 */
  it('caps how long it waits', () => {
    expect(nextPace({ consecutiveFailures: 50 }).waitMs).toBeLessThanOrEqual(5 * 60_000)
  })

  /*
   * 여러 번 쉬고도 안 되면 하루 한도다. 그때는 그만둔다 — 기다려도 자정까지
   * 안 풀리고, 목록을 태우면 다음 실행이 무엇을 안 했는지도 흐려진다.
   */
  it('stops once waiting clearly is not helping', () => {
    expect(nextPace({ consecutiveFailures: 6 }).stop).toBe(true)
  })

  /* 한 번 성공하면 처음으로 돌아간다. 잠깐 막힌 것까지 누적하면 금방 그만둔다 */
  it('resets after a success', () => {
    expect(nextPace({ consecutiveFailures: 0 })).toMatchObject({ waitMs: 0, stop: false })
  })
})
