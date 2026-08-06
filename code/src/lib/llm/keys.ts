/**
 * API 키 목록.
 *
 * `GOOGLE_GENERATIVE_AI_API_KEY`가 1순위이고
 * `..._2`, `..._3` 순으로 예비 키를 잇는다.
 *
 * 무료 티어 한도는 키가 아니라 프로젝트에 붙는다. 서로 다른 프로젝트의 키를
 * 늘어놓으면 총 처리량이 늘어나는데, Google 약관은 한도 우회를 금지한다.
 * 여기서는 그걸 노리지 않는다. 키가 폐기되거나 인증이 깨졌을 때 서비스가
 * 죽지 않게 하는 것이 목적이다.
 */
const MAX_KEYS = 10

export function loadApiKeys(): string[] {
  const keys: string[] = []

  const primary = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  if (primary) keys.push(primary)

  for (let i = 2; i <= MAX_KEYS; i += 1) {
    const extra = process.env[`GOOGLE_GENERATIVE_AI_API_KEY_${i}`]?.trim()
    if (extra) keys.push(extra)
  }

  return keys
}

export function hasApiKey(): boolean {
  return loadApiKeys().length > 0
}
