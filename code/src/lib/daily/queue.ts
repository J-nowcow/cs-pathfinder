/**
 * 발행 대기열이 얼마나 남았는가.
 *
 * **발행이 세 번 실패하는 동안 아무 일도 안 일어난 것처럼 보였다.** 발행분이
 * 앞으로 며칠치 미리 잡혀 있어서 화면은 멀쩡했다. 그 여유가 마르는 날 갑자기
 * "오늘 치 질문"이 사라진다.
 *
 * 실패가 조용한 것이 문제이지 실패 자체가 즉시 보이지는 않는 구조다. 그래서
 * 남은 날을 세는 판단을 한자리에 둔다 — 진단 스크립트에 묻어 두면 임계값이
 * 조용히 바뀌어도 아무도 모른다.
 */
export type QueueHealth = {
  status: 'ok' | 'low' | 'empty'
  /** 사람이 읽는 한 줄. 그대로 찍는다 */
  message: string
}

/**
 * 이 날짜 아래로 떨어지면 알린다.
 *
 * 발행은 하루 하나다. 이틀치면 **내일과 모레**뿐이라, 오늘 알아채면 고칠 시간이
 * 하루 남는다. 하루로 잡으면 알아챈 날이 곧 마지막 날이라 늦다.
 */
export const LOW_RUNWAY_DAYS = 2

export function queueHealth(input: { hasToday: boolean; ahead: number }): QueueHealth {
  if (!input.hasToday && input.ahead === 0) {
    return { status: 'empty', message: '대기열이 비었다. 화면이 지난 질문을 보여준다' }
  }
  if (input.ahead <= LOW_RUNWAY_DAYS) {
    return {
      status: 'low',
      message: `앞으로 ${input.ahead}일치뿐이다. 발행이 실패하고 있는지 본다`,
    }
  }
  return { status: 'ok', message: `앞으로 ${input.ahead}일치 남았다` }
}
