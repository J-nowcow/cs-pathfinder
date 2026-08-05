/**
 * 공유 트리의 제목과 요약.
 *
 * 둘 다 OG 태그로 나간다. 이 서비스의 유입은 카톡 링크라 미리보기에 뜨는 두 줄이
 * 사실상 첫 화면이다.
 *
 * LLM을 부르지 않는다. 공유 버튼을 누르고 몇 초를 기다리게 만들 이유가 없고,
 * 설계 §5의 "AI 생성 요약"은 daily 트리 쪽 얘기다. 공유 트리의 요약은 사용자가
 * 실제로 판 경로를 그대로 적는 편이 더 정확하다.
 */

/** 카톡 미리보기 제목이 대략 이 근처에서 잘린다 */
export const MAX_TITLE_LENGTH = 80
export const MAX_SUMMARY_LENGTH = 160

const FALLBACK_TITLE = '이름 없는 트리'

/**
 * 제목에 들어오면 안 되는 문자를 턴다.
 *
 * 줄바꿈은 공백으로 접는다. 카드와 og:title은 한 줄짜리 자리다.
 * 폭 없는 문자와 제어문자는 지운다. 길이 제한을 우회해서 게시판에 빈 카드처럼
 * 보이는 항목을 만들 수 있다.
 *
 * 정규식 리터럴 대신 코드포인트로 거른다. 지워야 할 문자가 전부 눈에 안 보이는
 * 것들이라 패턴에 넣으면 소스에서도 안 보인다. 편집기나 diff를 거치며 하나가
 * 사라져도 알아챌 방법이 없다. 숫자로 적으면 읽을 수 있고 깨지지도 않는다.
 */
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0xfeff])

function isRemovable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0

  // 폭 없는 문자를 공백 검사보다 먼저 본다. JS의 \s는 U+FEFF를 공백으로 치는데,
  // 그대로 두면 낱말 사이의 BOM 하나가 공백으로 바뀌어 없던 띄어쓰기가 생긴다
  if (ZERO_WIDTH.has(code)) return true

  // 탭·줄바꿈은 여기서 지우지 않는다. 바로 아래에서 공백으로 접힌다
  if (/\s/.test(ch)) return false

  // C0 제어문자와 DEL, 그리고 C1 제어문자
  return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

function clean(raw: string): string {
  let out = ''
  for (const ch of raw) {
    if (!isRemovable(ch)) out += ch
  }
  return out.replace(/\s+/g, ' ').trim()
}

function cut(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1)}…`
}

/** 루트 질문을 그대로 제목으로 쓴다. 트리의 출발점이 곧 그 트리의 이름이다 */
export function deriveTitle(rootQuestion: string): string {
  const cleaned = clean(rootQuestion)
  return cleaned.length > 0 ? cut(cleaned, MAX_TITLE_LENGTH) : FALLBACK_TITLE
}

/**
 * 사용자가 고친 제목을 받는다.
 *
 * 공유는 "내가 판 것"을 남기는 행위라 이름을 붙일 수 있어야 한다. 다만 안 붙여도
 * 흐름이 끊기면 안 되므로 비면 루트 질문으로 떨어진다.
 */
export function normalizeTitle(input: string | null | undefined, rootQuestion: string): string {
  const cleaned = clean(input ?? '')
  return cleaned.length > 0 ? cut(cleaned, MAX_TITLE_LENGTH) : deriveTitle(rootQuestion)
}

/**
 * 요약은 실제로 판 길이다.
 *
 * 가장 깊은 줄기를 화살표로 잇는다. "질문 5개" 같은 숫자만으로는 무엇을 팠는지
 * 안 보이는데, 링크를 받은 사람이 누를지 말지 정하는 건 그 내용이다.
 *
 * 줄기에 안 실린 가지는 개수로 덧붙인다. 트리라는 걸 한 마디로 알린다.
 */
export function deriveSummary(trail: string[], totalNodes: number): string {
  const parts = trail.map(clean).filter((s) => s.length > 0)
  if (parts.length === 0) return ''

  const rest = Math.max(0, totalNodes - parts.length)
  const suffix = rest > 0 ? ` 외 ${rest}개` : ''

  // 뒤쪽부터 덜어낸다. 앞이 뿌리라 맥락을 더 많이 쥐고 있다.
  const shown = [...parts]
  let text = shown.join(' → ') + suffix

  while (shown.length > 1 && text.length > MAX_SUMMARY_LENGTH) {
    shown.pop()
    text = `${shown.join(' → ')}…${suffix}`
  }

  return cut(text, MAX_SUMMARY_LENGTH)
}
