/**
 * 정규화된 질문의 어투 검사.
 *
 * 게이트는 새 질문을 만들 때 "존댓말·반말·축약을 없애고 평서 의문문으로 통일"하라고
 * 지시받는다. 지시가 지켜지는지는 지금까지 아무도 안 봤다. 실제로 공유 트리 화면에
 * "…그 이유가 궁금합니다."로 끝나는 노드가 떠 있었다.
 *
 * 어투는 화면에 그대로 나가고 노드는 여러 경로에서 도달한다. 한 트리 안에서
 * 어떤 질문은 "~인가?"고 어떤 질문은 "~궁금합니다"면 같은 서비스가 쓴 문장으로
 * 안 읽힌다.
 *
 * **판정에는 쓰지 않는다.** 걸렀다고 거절하면 멀쩡한 질문이 문전에서 막힌다.
 * 어색한 어투는 읽는 데 지장이 없지만 막히면 아무것도 못 한다. 지금은 재기만 한다.
 */

/**
 * 경어체·해요체로 끝나는 꼬리들.
 *
 * 목표형은 "~인가", "~하는가", "~무엇인가" 같은 평서 의문문이다. 이것들은
 * 대개 "가"나 "나"로 끝나므로, 여기서는 정중형 어미만 골라 잡는다.
 *
 * 순서가 길이 내림차순인 것은 의미가 없다. 정규식 교대는 어차피 끝을 앵커로 본다.
 */
const POLITE_ENDINGS = [
  // 격식체
  '습니다',
  '입니다',
  '합니다',
  '됩니다',
  '습니까',
  '입니까',
  '합니까',
  // 해요체
  '나요',
  '까요',
  '가요',
  '어요',
  '아요',
  '에요',
  '예요',
  '해요',
  '세요',
  '지요',
  '죠',
] as const

const POLITE_RE = new RegExp(`(${POLITE_ENDINGS.join('|')})$`)

/** 물음표·마침표·공백을 턴 뒤의 마지막 글자들을 본다 */
function tail(question: string): string {
  return question.trim().replace(/[?？!.…\s]+$/, '')
}

/**
 * 정중형 어미로 끝나는가.
 *
 * 문장 중간의 경어는 안 본다. 어미만 바꿔도 화면에서는 충분히 통일돼 보이고,
 * 중간까지 잡으려 들면 인용이나 고유명사에서 헛걸린다.
 */
export function hasPoliteEnding(question: string): boolean {
  return POLITE_RE.test(tail(question))
}

/**
 * 의문문으로 끝나는가.
 *
 * 질문 목록에 서술문이 섞이면 무엇을 누르는 자리인지 흐려진다. 물음표가 없어도
 * "~인가" 꼴이면 의문문으로 본다 — 물음표를 빠뜨리는 것이 더 흔한 실수다.
 */
const INTERROGATIVE_RE = /(가|나|까|지)$/

export function looksInterrogative(question: string): boolean {
  return question.trim().endsWith('?') || INTERROGATIVE_RE.test(tail(question))
}

export type FormIssue = 'polite' | 'not-interrogative'

/** 어떤 규칙을 어겼는지 전부 돌려준다. 하나만 보면 나머지가 가려진다 */
export function questionFormIssues(question: string): FormIssue[] {
  const issues: FormIssue[] = []
  if (hasPoliteEnding(question)) issues.push('polite')
  if (!looksInterrogative(question)) issues.push('not-interrogative')
  return issues
}
