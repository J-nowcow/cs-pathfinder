/**
 * 해설 본문의 최소 인라인 마크업.
 *
 * HTML을 만들지 않는다. 토큰만 돌려주고 렌더러가 React 요소로 바꾼다.
 * 자유 입력이 전역 자산이 되므로 오염이 증폭된다. innerHTML 경로를 아예 두지 않는 편이 낫다.
 *
 * 생성 프롬프트가 문단·굵게·코드만 쓰도록 지시하므로 그 셋만 다룬다.
 */
export type InlineToken = {
  type: 'text' | 'bold' | 'code' | 'mark'
  value: string
}

export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/*
 * 빈 쌍(**** 나 ``)은 잡지 않는다. 마크업이 아니라 문자 그대로일 확률이 높다.
 *
 * 세 번째 갈래가 하이라이트다. 굵게와 나눠 쓴다 — 굵게는 문장 안의 낱말을
 * 집고, 하이라이트는 **답 그 자체인 구절**을 집는다. 편마다 한 곳이 상한이라
 * 둘이 겹칠 일이 잘 없다.
 *
 * 줄바꿈을 막는 것(`[^=\n]`)이 여기서 중요하다. 안 막으면 문단 어딘가의 `==`
 * 하나가 다음 문단의 `==`와 짝을 이뤄 그 사이를 통째로 칠한다. 수식이 줄을
 * 안 넘게 한 것과 같은 이유다.
 *
 * 마지막 갈래는 LaTeX 수식이다. 프롬프트가 시킨 적이 없는데 모델이 쓴다 —
 * 화면에서 `$O(1)$`을 세어보니 노드 다섯 개에서 나왔고, 표 칸에 달러 기호가
 * 그대로 찍혀 있었다. 파서가 모르면 문자 그대로 나가고, 그게 고장으로 읽힌다.
 *
 * 렌더링은 안 한다. KaTeX를 붙이면 2MB가 따라오고 이 서비스의 수식은 `O(n)`이
 * 거의 전부다. 그건 코드 조각으로 충분하다. 달러만 벗겨 코드로 넘긴다.
 *
 * **갈래 순서가 곧 우선순위다.** 코드가 하이라이트보다 앞에 있어야 `` `a == b` ``
 * 같은 비교 연산이 강조로 새지 않는다.
 */
const MARKER = /\*\*([^*]+?)\*\*|`([^`]+?)`|==([^=\n]+?)==|\$([^$\n]+?)\$/g

/**
 * LaTeX 표기를 사람이 읽는 문자로 바꾼다.
 *
 * 다 다루지 않는다. 실제로 나온 것만 본다 — `\log`, `\rightarrow` 두 종류였다.
 * 안 다루는 명령은 백슬래시만 떼고 남긴다. 모르는 것을 지우면 뜻이 사라진다.
 */
function stripLatex(expr: string): string {
  return expr
    .replace(/\\(?:rightarrow|to)\b/g, '→')
    .replace(/\\(?:leftarrow)\b/g, '←')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\l(?:e|eq)\b/g, '≤')
    .replace(/\\g(?:e|eq)\b/g, '≥')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let cursor = 0

  for (const m of text.matchAll(MARKER)) {
    const at = m.index
    if (at > cursor) tokens.push({ type: 'text', value: text.slice(cursor, at) })

    if (m[1] !== undefined) tokens.push({ type: 'bold', value: m[1] })
    else if (m[2] !== undefined) tokens.push({ type: 'code', value: m[2] })
    else if (m[3] !== undefined) tokens.push({ type: 'mark', value: m[3] })
    else tokens.push({ type: 'code', value: stripLatex(m[4]) })

    cursor = at + m[0].length
  }

  // 닫히지 않은 마커는 문자 그대로 남는다. 깨진 마크업이 본문을 먹어치우면 안 된다.
  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) })

  return tokens
}
