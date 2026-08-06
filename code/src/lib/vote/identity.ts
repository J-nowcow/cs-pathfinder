import { randomUUID } from 'node:crypto'

/**
 * 투표자 식별.
 *
 * 인증이 없어서 "이 사람이 이미 눌렀나"를 판단할 근거가 브라우저에만 있다.
 *
 * IP를 안 쓴다. 국내 모바일 캐리어는 NAT가 심해서 수백 명이 같은 출구 IP를 쓴다.
 * IP로 묶으면 그중 한 명이 누른 순간 나머지가 전부 "이미 누름"이 되고, 화면은
 * 아무 설명 없이 눌리지 않는다. 진짜 사용자를 막는 실패가 중복 한 표보다 나쁘다.
 *
 * 쿠키는 지우면 다시 누를 수 있다. 그건 안다. 추천 수는 정렬 힌트지 집계 지표가
 * 아니고, 이 규모에서 조작할 동기도 없다. 표가 돈이 되는 날 다시 볼 문제다.
 *
 * httpOnly로 둔다. 화면에서 읽을 일이 없고, 스크립트가 못 만지면 확장 프로그램이나
 * XSS로 남의 식별자를 바꿔치기하는 경로가 하나 줄어든다.
 */
export const VOTER_COOKIE = 'cspf_vid'

/** 1년. 그 사이에 브라우저를 안 바꾸면 자기 표를 계속 알아본다 */
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function newVoterId(): string {
  return randomUUID()
}

/**
 * 쿠키 값이 우리가 발급한 모양인지 본다.
 *
 * 사용자가 고친 값이 그대로 DB 키가 되면 아무 문자열이나 voter_key로 들어간다.
 * 길이 제한이 없어서 큰 값을 넣으면 인덱스만 불린다. 모양이 아니면 새로 발급한다.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isVoterId(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** DB에 저장하는 키. 인증이 붙으면 `user:<uid>`가 같은 자리에 들어간다 */
export function voterKey(voterId: string): string {
  return `anon:${voterId}`
}
