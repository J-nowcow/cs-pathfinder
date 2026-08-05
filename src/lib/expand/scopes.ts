/**
 * 정규화 오병합을 막는 의미 범위.
 *
 * "락은 언제 해제되는가?"는 java / os / postgres 에서 서로 다른 질문이다.
 * 표면 문장이 같아도 스코프가 다르면 다른 노드가 된다.
 *
 * 잘못 나눈 노드는 나중에 합칠 수 있지만 잘못 합친 노드는 복구가 안 된다.
 * 그래서 게이트는 확신이 없으면 더 좁은 스코프를 고르도록 지시한다.
 */
export const IDENTITY_SCOPES = [
  'generic',
  'java',
  'jvm',
  'spring',
  'javascript',
  'typescript',
  'python',
  'os',
  'linux',
  'network',
  'http',
  'tcp',
  'sql',
  'postgres',
  'mysql',
  'redis',
  'docker',
  'kubernetes',
  'react',
  'android',
  'ios',
  'security',
] as const

export type IdentityScope = (typeof IDENTITY_SCOPES)[number]

export function isIdentityScope(value: string): value is IdentityScope {
  return (IDENTITY_SCOPES as readonly string[]).includes(value)
}
