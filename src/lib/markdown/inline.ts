/**
 * 해설 본문의 최소 인라인 마크업.
 *
 * HTML을 만들지 않는다. 토큰만 돌려주고 렌더러가 React 요소로 바꾼다.
 * 자유 입력이 전역 자산이 되므로 오염이 증폭된다. innerHTML 경로를 아예 두지 않는 편이 낫다.
 *
 * 생성 프롬프트가 문단·굵게·코드만 쓰도록 지시하므로 그 셋만 다룬다.
 */
export type InlineToken = {
  type: 'text' | 'bold' | 'code'
  value: string
}

export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

// 빈 쌍(**** 나 ``)은 잡지 않는다. 마크업이 아니라 문자 그대로일 확률이 높다.
const MARKER = /\*\*([^*]+?)\*\*|`([^`]+?)`/g

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let cursor = 0

  for (const m of text.matchAll(MARKER)) {
    const at = m.index
    if (at > cursor) tokens.push({ type: 'text', value: text.slice(cursor, at) })

    if (m[1] !== undefined) tokens.push({ type: 'bold', value: m[1] })
    else tokens.push({ type: 'code', value: m[2] })

    cursor = at + m[0].length
  }

  // 닫히지 않은 마커는 문자 그대로 남는다. 깨진 마크업이 본문을 먹어치우면 안 된다.
  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) })

  return tokens
}
