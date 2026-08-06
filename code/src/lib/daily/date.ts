/**
 * 발행일은 KST 기준이다.
 *
 * 할당량도 KST 자정에 리셋한다(0003_functions.sql의 quota_today).
 * 서버가 UTC로 돌아도 사용자가 보는 "오늘"은 하나여야 한다.
 */
const KST = 'Asia/Seoul'

/** 'YYYY-MM-DD'. en-CA 로케일이 ISO 순서로 찍어준다 */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 자문 잠금(advisory lock) 키.
 *
 * 발행을 두 프로세스가 동시에 시도하면 같은 날짜에 두 트리가 만들어질 수 있다.
 * 유니크 인덱스가 최후에 막지만 그때는 이미 시드를 쓰고 LLM도 태운 뒤다.
 * 날짜를 잠가서 진입 자체를 직렬화한다.
 *
 * 20260806처럼 읽히는 정수라 해시를 쓰지 않는다. int4 범위 안이라 9999년까지 안전하다.
 */
export function kstDateKey(date: string): number {
  const m = DATE_SHAPE.exec(date)
  if (!m) throw new Error(`발행일 형식이 YYYY-MM-DD가 아니다: ${date}`)
  return Number(`${m[1]}${m[2]}${m[3]}`)
}

/**
 * 오늘의 질문 slug.
 *
 * 날짜에서 바로 파생한다. 하루 하나라는 제약을 유니크 인덱스가 이미 걸고 있어
 * 충돌이 구조적으로 불가능하고, 주소만 봐도 언제 것인지 읽힌다.
 */
export function dailySlug(date: string): string {
  if (!DATE_SHAPE.test(date)) throw new Error(`발행일 형식이 YYYY-MM-DD가 아니다: ${date}`)
  return `daily-${date}`
}
