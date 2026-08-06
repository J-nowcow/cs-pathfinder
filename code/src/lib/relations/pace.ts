/**
 * 한도에 막혔을 때의 처신.
 *
 * 실측에서 나왔다. gemma 한도에 걸리자 배치가 남은 질문 102개를 순식간에 전부
 * 실패로 태웠다. 그 실행의 성공은 1개였다.
 *
 * 원인이 얄궂다. AI SDK의 내부 재시도를 끈 직후에 생겼다. 예전에는 호출마다
 * 7초를 버렸고 그 느림이 우연히 쉬어가는 역할을 했다. 빠르게 만들자 목록을
 * 빠르게 태우게 됐다. 쉬는 것은 우연이 아니라 정해 둬야 한다.
 */

/** 첫 실패에 쉬는 시간. 분당 한도 창이 대개 이만큼이면 풀린다 */
const BASE_MS = 45_000

/** 아무리 늘어도 이보다 오래 쉬지 않는다. 넘어가면 사람이 멈춘 줄 안다 */
const MAX_MS = 5 * 60_000

/**
 * 이만큼 연속으로 막히면 그만둔다.
 *
 * 다섯 번 쉬고도 안 되면 분당이 아니라 하루 한도다. 자정까지 안 풀리므로
 * 기다릴 이유가 없다. 목록을 태우지 않고 멈추면 다음 실행이 남은 질문을
 * 그대로 이어받는다.
 */
const GIVE_UP = 6

export type Pace = {
  /** 다음 질문 전에 쉴 시간 */
  waitMs: number
  /** 이번 실행을 여기서 끝낼 것인가 */
  stop: boolean
}

/** 연속 실패 횟수를 보고 다음에 무엇을 할지 정한다 */
export function nextPace({ consecutiveFailures }: { consecutiveFailures: number }): Pace {
  if (consecutiveFailures === 0) return { waitMs: 0, stop: false }
  if (consecutiveFailures >= GIVE_UP) return { waitMs: 0, stop: true }

  // 2배씩 늘린다. 같은 간격으로 두드리면 풀리는 족족 한도를 다시 먹는다
  return { waitMs: Math.min(MAX_MS, BASE_MS * 2 ** (consecutiveFailures - 1)), stop: false }
}
