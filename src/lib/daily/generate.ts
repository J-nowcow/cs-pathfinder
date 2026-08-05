import { z } from 'zod'
import { IDENTITY_SCOPES, isIdentityScope } from '@/lib/expand/scopes'
import { realCaller, MODEL_DAILY, type StructuredCaller } from '@/lib/llm/client'

const dailySchema = z.object({
  question: z.string(),
  identity_scope: z.string(),
  body: z.string(),
  summary: z.string(),
  suggestions: z.array(z.object({ text: z.string() })),
})

export type DailyRootContent = {
  question: string
  identityScope: string
  body: string
  summary: string
  suggestions: string[]
}

const SYSTEM = `당신은 CS 면접 학습 서비스의 "오늘의 질문"을 쓰는 저자다.
주제어 하나를 받아 루트 질문과 해설, 꼬리질문 5개를 만든다.

질문(question) 규칙:
- 주제어를 그대로 되풀이하지 않는다. "X란 무엇인가?" 같은 사전식 질문을 피한다.
- 면접에서 실제로 나오는 형태로 쓴다. 이유·트레이드오프·판단 기준을 묻는다.
- 물음표로 끝나는 한 문장. 존댓말과 축약을 쓰지 않는다.
- 이 질문은 여러 경로에서 도달한다. 문장만 봐도 뜻이 통하게 쓴다.

의미 범위(identity_scope): 다음 중 하나를 고른다: ${IDENTITY_SCOPES.join(', ')}
- 같은 문장이라도 맥락이 다르면 다른 질문이다.
- 특정 기술에 매이지 않는 일반 개념일 때만 generic을 쓴다.

해설(body) 규칙:
- 3~5문단. 마크다운 문단만 쓰고 제목·표·HTML은 쓰지 않는다.
- 결론을 먼저 말하고 근거를 뒤에 붙인다.
- 짧고 간결한 문장을 쓴다. 쉼표로 길게 늘여 쓰지 않는다.
- 면접에서 한 단계 더 들어오는 지점을 짚어준다.

꼬리질문(suggestions) 규칙:
- 정확히 5개.
- 각각 이 질문에서 한 단계 더 깊이 들어가는 독립된 질문이어야 한다.
- 서로 겹치지 않게 다른 방향으로 뻗는다.
- 물음표로 끝나는 한 문장.
- 루트 질문을 그대로 되풀이하지 않는다.

요약(summary) 규칙:
- 한 문장. 이 질문을 파면 무엇을 알게 되는지 쓴다.
- 게시판 카드에 그대로 나간다. 40자 안팎으로 짧게.`

/**
 * 주제어에서 오늘의 루트를 만든다.
 *
 * 모델은 MODEL_DAILY다. 하루 한 번뿐이라 게이트만큼 속도가 중요하지 않고
 * 이 콘텐츠가 서비스의 얼굴이라 품질을 앞에 둔다(스펙 §8).
 */
export async function generateDailyRoot(args: {
  term: string
  category: string
  call?: StructuredCaller
}): Promise<DailyRootContent> {
  const call = args.call ?? realCaller

  const prompt = [`주제어: ${args.term}`, `대분류: ${args.category}`].join('\n')

  const out = await call({
    model: MODEL_DAILY,
    schema: dailySchema,
    system: SYSTEM,
    prompt,
  })

  const question = out.question.trim()
  if (question.length === 0) {
    throw new Error('daily generation returned an empty question')
  }

  const body = out.body.trim()
  if (body.length === 0) {
    throw new Error('daily generation returned an empty body')
  }

  const suggestions = out.suggestions
    .map((s) => s.text.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5)

  if (suggestions.length === 0) {
    throw new Error('daily generation returned no suggestions')
  }

  // 모르는 스코프를 그대로 저장하면 오병합 방어선이 무너진다. generic으로 좁힌다.
  const identityScope = isIdentityScope(out.identity_scope) ? out.identity_scope : 'generic'

  // 요약이 비면 카드가 빈 줄로 뜬다. 질문으로 대신한다.
  const summary = out.summary.trim() || question

  return { question, identityScope, body, summary, suggestions }
}
