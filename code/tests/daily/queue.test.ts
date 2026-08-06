import { describe, it, expect } from 'vitest'
import { queueHealth } from '@/lib/daily/queue'

/**
 * 발행 대기열이 얼마나 남았는가.
 *
 * **발행이 세 번 실패하는 동안 아무 일도 안 일어난 것처럼 보였다.** 앞으로
 * 며칠치가 미리 잡혀 있어서 화면이 멀쩡했기 때문이다. 그 여유가 마르는 날
 * 갑자기 "오늘 치 질문"이 사라진다.
 *
 * 임계값을 스크립트에 묻어 두면 조용히 바뀌어도 아무도 모른다. 그래서 여기서
 * 못 박는다.
 */
describe('queueHealth', () => {
  it('넉넉하면 조용하다', () => {
    expect(queueHealth({ hasToday: true, ahead: 6 }).status).toBe('ok')
  })

  /*
   * 이틀이면 내일과 모레뿐이다. 오늘 알아채야 고칠 하루가 남는다.
   *
   * **숫자를 그대로 쓴다.** 처음에 `LOW_RUNWAY_DAYS`를 가져다 썼더니 임계값을
   * 0으로 낮추는 변이에서 기대값도 같이 움직여 시험이 그냥 통과했다. 자기
   * 자신을 시험하는 꼴이라 아무것도 못 지켰다.
   */
  it('이틀치면 알린다', () => {
    expect(queueHealth({ hasToday: true, ahead: 2 }).status).toBe('low')
  })

  it('사흘치는 아직 조용하다', () => {
    expect(queueHealth({ hasToday: true, ahead: 3 }).status).toBe('ok')
  })

  it('오늘 것도 앞으로 것도 없으면 비었다고 말한다', () => {
    const h = queueHealth({ hasToday: false, ahead: 0 })
    expect(h.status).toBe('empty')
    expect(h.message).toContain('지난 질문')
  })

  /* 오늘 것이 있으면 앞이 비어도 아직 화면은 멀쩡하다. 그래도 급하다 */
  it('오늘 것만 있고 앞이 없으면 비었다고 하지 않는다', () => {
    expect(queueHealth({ hasToday: true, ahead: 0 }).status).toBe('low')
  })

  it('남은 날을 숫자로 말한다', () => {
    expect(queueHealth({ hasToday: true, ahead: 6 }).message).toContain('6일치')
  })
})
