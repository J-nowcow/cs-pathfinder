/**
 * 며칠에 몇 편을 팠는지.
 *
 * `journey`가 이미 발자국을 들고 있지만 **시각이 없다.** 그 파일의 주석이
 * 그렇게 적어 뒀다 -- "저장된 것에 시각이 없어서 언제 팠는지 모른다".
 * 잔디는 날짜가 있어야 그린다.
 *
 * `Occurrence`에 시각을 더하고 스키마 버전을 올리는 길도 있다. 그러면 지금
 * 저장된 여정이 통째로 버려진다(버전이 다르면 `deserializeJourney`가 `null`을
 * 낸다). 잔디 하나 때문에 남의 기록을 지울 이유가 없다. **따로 적는다.**
 *
 * 계정은 아직 없다. 그래서 서버로 안 보내고 이 브라우저에만 남긴다. 로그인이
 * 붙는 날 같은 모양으로 올려 합치면 된다.
 */
export const STREAK_STORAGE_KEY = 'csqt.streak.v1'

const SCHEMA_VERSION = 1

/**
 * 남길 날 수.
 *
 * 잔디는 1년을 그리므로 366일이면 충분하지만 조금 더 둔다. 하루치가
 * 아이디 몇 개라 400일이라도 수십 KB다.
 *
 * 상한이 있어야 하는 이유는 용량이 아니라 **저장이 실패하는 날이 오기
 * 때문이다.** 무한히 늘어나는 값을 매번 통째로 쓰면 언제 넘는지 아무도 모른다.
 */
export const MAX_DAYS = 400

/**
 * 하루에 셀 최대 편수.
 *
 * 사람이 하루에 200편을 읽지는 않는다. 넘어가면 그날 잔디는 이미 제일 진하다.
 */
export const MAX_PER_DAY = 200

/** 날짜 -> 그날 연 질문의 id들 */
export type StreakState = { days: Record<string, string[]> }

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

export function emptyStreak(): StreakState {
  return { days: {} }
}

export function serializeStreak(state: StreakState): string {
  return JSON.stringify({ version: SCHEMA_VERSION, ...state })
}

/**
 * 저장된 것을 읽는다. 이상하면 빈 것을 준다.
 *
 * **던지지 않는다.** localStorage 내용은 사용자가 언제든 손댈 수 있고, 여기서
 * 던지면 잔디가 아니라 페이지가 통째로 죽는다.
 */
export function deserializeStreak(raw: string | null): StreakState {
  if (!raw) return emptyStreak()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyStreak()
  }
  if (typeof parsed !== 'object' || parsed === null) return emptyStreak()

  const p = parsed as Record<string, unknown>
  if (p.version !== SCHEMA_VERSION) return emptyStreak()
  if (typeof p.days !== 'object' || p.days === null) return emptyStreak()

  const days: Record<string, string[]> = {}
  for (const [day, ids] of Object.entries(p.days as Record<string, unknown>)) {
    if (!DATE_SHAPE.test(day)) continue
    if (!Array.isArray(ids)) continue
    const clean = ids.filter((v): v is string => typeof v === 'string').slice(0, MAX_PER_DAY)
    if (clean.length > 0) days[day] = clean
  }
  return { days }
}

/**
 * 오늘 이 질문을 봤다고 적는다.
 *
 * **같은 질문을 다시 열어도 한 번만 센다.** 새로고침 한 번에 잔디가 진해지면
 * 그 숫자는 아무 뜻이 없다. 그래서 개수가 아니라 id를 들고 있는다.
 *
 * 같은 상태를 그대로 돌려주면(변화 없음) 부르는 쪽이 저장을 건너뛸 수 있다.
 */
export function recordRead(state: StreakState, day: string, nodeId: string): StreakState {
  if (!DATE_SHAPE.test(day) || nodeId.length === 0) return state

  const today = state.days[day] ?? []
  if (today.includes(nodeId)) return state
  if (today.length >= MAX_PER_DAY) return state

  const days = { ...state.days, [day]: [...today, nodeId] }

  /* 오래된 날부터 버린다. 날짜 문자열이 ISO라 그냥 정렬하면 시간 순이다 */
  const keys = Object.keys(days).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete days[k]

  return { days }
}

/** 지금까지 판 질문 수. 같은 질문을 다른 날 다시 봤으면 따로 센다 */
export function totalRead(state: StreakState): number {
  return Object.values(state.days).reduce((n, ids) => n + ids.length, 0)
}

/** 서로 다른 질문 수 */
export function distinctRead(state: StreakState): number {
  const seen = new Set<string>()
  for (const ids of Object.values(state.days)) for (const id of ids) seen.add(id)
  return seen.size
}

/** 하루 앞으로. 'YYYY-MM-DD'만 받는다 */
export function shiftDay(day: string, delta: number): string {
  const t = Date.parse(`${day}T00:00:00Z`)
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10)
}

/**
 * 며칠 이어서 팠는가.
 *
 * **오늘 아직 안 팠어도 어제까지 이어졌으면 살아 있다.** 아침에 들어왔다고
 * 어제까지의 기록이 0으로 보이면 그건 벌이지 응원이 아니다.
 */
export function streakLength(state: StreakState, today: string): number {
  let day = state.days[today]?.length ? today : shiftDay(today, -1)
  let n = 0
  while (state.days[day]?.length) {
    n += 1
    day = shiftDay(day, -1)
  }
  return n
}
