import { parseBlocks } from '@/lib/markdown/blocks'
import { questionFormIssues } from '@/lib/llm/question-form'
import { proseIssues } from '@/lib/llm/prose'

/**
 * 생성된 해설이 규칙을 지켰는지 본다.
 *
 * **검사하지 않는 규칙은 규칙이 아니라 바람이다.**
 *
 * 규칙은 원래 세 곳에 흩어져 있었다. 프롬프트(`llm/generate.ts`의 SYSTEM)가
 * 시키고, `scripts/build-generated-nodes.ts`의 `usable()`이 검사하고,
 * `prose.ts`·`question-form.ts`가 조각으로 셌다. 그런데 검사하는 쪽이 전부
 * `scripts/` 아래였다 — 한 번 돌린 오프라인 배치 전용이다.
 *
 * 그래서 코퍼스 249개는 걸러진 것인데 **매일 올라오는 오늘의 질문과 사용자가
 * 파는 모든 질문은 검사를 한 번도 안 거쳤다.** 비었는지만 봤다
 * (`llm/generate.ts`, `daily/generate.ts`).
 *
 * 여기가 그 한 곳이다. 배치도 운영도 이 함수를 부른다.
 */

/**
 * 막을 것과 적어둘 것.
 *
 * `block`은 독자가 화면에서 고장으로 읽는 것이다. 버튼 글자가 접히거나,
 * 문단이 벽이거나, `:::`가 그대로 보이거나, 한 트리 안에서 말투가 갈린다.
 *
 * `note`는 어긋났지만 화면이 깨지지는 않는 것이다. 다시 부르는 값보다
 * 그냥 내보내는 편이 나은 자리다. 세어는 둔다 — 세지 않으면 나빠지는 것도
 * 모른다.
 */
export type Severity = 'block' | 'note'

export type ContentIssue = {
  /** 어떤 규칙인지. 집계할 때 이 값으로 묶는다 */
  rule: string
  /** 사람이 읽는 설명. 모델에게 돌려줄 때도 이 문장을 쓴다 */
  detail: string
  severity: Severity
}

/** 문단이 이보다 길면 폰에서 여섯 줄이 넘어 그 자체가 벽이다 */
export const MAX_PARAGRAPH = 150
/** 꼬리질문은 버튼과 게시판 제목에 그대로 나간다. 넘으면 줄이 접힌다 */
export const MAX_SUGGESTION = 35
/** 답을 말하고 곧바로 보여준다. 줄글을 이만큼 쌓은 뒤면 늦다 */
export const DIAGRAM_BY = 3

/**
 * 해설 하나를 검사한다.
 *
 * 부르는 쪽이 문단을 다시 쪼갤 필요가 없게 `parseBlocks`를 여기서 돌린다.
 * 도식 안은 문장 규칙을 안 댄다 — `:::flow`의 라벨은 문장이 아니라 이름표라
 * 문장 규칙을 대면 전부 걸린다.
 */
export function contentIssues(c: { body: string; suggestions: string[] }): ContentIssue[] {
  const out: ContentIssue[] = []
  const blocks = parseBlocks(c.body)

  const firstDiagram = blocks.findIndex((b) => b.type !== 'paragraph')

  /*
   * 도식이 없는 자리는 두 가지다. 성격이 정반대라 갈라야 한다.
   *
   * **안 그린 것**은 정상이다. 넣을 것이 없으면 넣지 말라고 프롬프트에 적었고,
   * 억지로 만든 도식은 없는 것보다 나쁘다. 실측에서도 12편 중 3편이 도식 없이
   * 나왔고 그게 맞는 판단이었다. 다시 부르면 없는 도식을 지어내게 만든다.
   *
   * **그리려다 삼켜진 것**은 결함이다. 모델이 `::: flow`처럼 조금 틀리게 쓰면
   * 그 자리가 통째로 사라진다. 독자에게는 "안 그린 것"과 똑같이 보이는데
   * 실제로는 있어야 할 그림이 없어진 것이다.
   *
   * 원문에 울타리 흔적이 있는지로 가른다. 전에는 파싱한 **문단**에서 `:::`를
   * 찾았는데(`usable()`이 그랬다), `parseBlocks`는 알아본 울타리도 못 알아본
   * 울타리도 전부 털어내고 문단을 내놓는다. 그래서 그 검사는 **참이 될 수 없는
   * 죽은 코드**였다. 한 번도 발동한 적 없이 검사한다는 안심만 줬다.
   */
  if (firstDiagram < 0) {
    const meant = /:::/.test(c.body)
    out.push(
      meant
        ? {
            rule: '도식삼킴',
            detail: '도식을 쓰려다 문법이 어긋나 통째로 사라졌다. 예시 그대로의 모양으로 써라',
            severity: 'block',
          }
        : { rule: '도식없음', detail: '도식이 하나도 없다', severity: 'note' },
    )
  } else if (firstDiagram >= DIAGRAM_BY) {
    out.push({
      rule: '도식위치',
      detail: `첫 도식이 ${firstDiagram + 1}번째 블록에 있다. 답 바로 뒤로 올려라`,
      severity: 'block',
    })
  }

  for (const b of blocks) {
    if (b.type !== 'paragraph') continue

    if (b.text.length > MAX_PARAGRAPH) {
      out.push({
        rule: '긴문단',
        detail: `문단 하나가 ${b.text.length}자다. ${MAX_PARAGRAPH}자 아래로 나눠라`,
        severity: 'block',
      })
    }

    for (const i of proseIssues(b.text)) {
      out.push({ rule: `문체:${i}`, detail: `문체가 어긋난다 — ${i}`, severity: 'note' })
    }
  }

  if (c.suggestions.length !== 5) {
    out.push({
      rule: '꼬리질문수',
      detail: `꼬리질문이 ${c.suggestions.length}개다. 정확히 5개여야 한다`,
      severity: 'block',
    })
  }

  for (const s of c.suggestions) {
    if (s.length > MAX_SUGGESTION) {
      out.push({
        rule: '꼬리질문길이',
        detail: `꼬리질문 "${s}"가 ${s.length}자다. ${MAX_SUGGESTION}자 아래로 줄여라`,
        severity: 'block',
      })
    }
    for (const i of questionFormIssues(s)) {
      out.push({
        rule: `꼬리질문형식:${i}`,
        detail:
          i === 'polite'
            ? `꼬리질문 "${s}"가 경어체다. 평어체로 써라`
            : `꼬리질문 "${s}"가 의문문이 아니다`,
        severity: 'block',
      })
    }
  }

  return out
}

/** 다시 부를 만한 것만 */
export function blocking(issues: ContentIssue[]): ContentIssue[] {
  return issues.filter((i) => i.severity === 'block')
}

/**
 * 모델에게 돌려줄 지적.
 *
 * 규칙을 다시 읊지 않는다. 그건 이미 SYSTEM에 있고, 같은 말을 되풀이하면
 * 무엇이 틀렸는지가 묻힌다. **틀린 자리만** 짚는다.
 */
export function complaint(issues: ContentIssue[]): string {
  const lines = [...new Set(blocking(issues).map((i) => i.detail))]
  return ['방금 쓴 것이 규칙을 어겼다. 아래만 고쳐 다시 써라.', ...lines.map((l) => `- ${l}`)].join(
    '\n',
  )
}
