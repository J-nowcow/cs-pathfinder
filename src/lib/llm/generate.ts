import { z } from 'zod'
import { realCaller, MODEL_GENERATE, type StructuredCaller } from '@/lib/llm/client'

const generateSchema = z.object({
  body: z.string(),
  suggestions: z.array(z.object({ text: z.string() })),
})

const SYSTEM = `당신은 CS 면접 학습 콘텐츠를 쓰는 저자다.

해설(body) 규칙:
- 3~5문단. 도식을 넣으면 그만큼 문단을 줄인다.
- **첫 문장이 질문에 그대로 답한다.** 배경이나 정의로 시작하지 않는다.
  질문의 의문사를 받아서 짧게 끝낸다.
    "왜 ~인가?"      → "~기 때문이다."
    "언제 / 어떤 경우?" → "~할 때다."
    "어디서 ~하는가?"  → "~에서다." 또는 무엇이 진짜 원인인지 한 문장
    "무엇을 잃는가?"   → "~를 잃는다."
  두 번째 문단부터 근거를 편다. 첫 문장만 읽고 나가도 답은 가져가게 한다.
- 짧고 간결한 문장을 쓴다. 쉼표로 길게 늘여 쓰지 않는다.
- **한 문단은 150자를 넘기지 않는다.** 폰에서 한 줄이 24자쯤이라 150자면 벌써 여섯 줄이다.
  그보다 길면 눈이 미끄러진다. 할 말이 남으면 문단을 나눈다.
- **평어체로 쓴다.** "~다"로 끝맺고 "~합니다" "~입니다" 같은 경어체를 쓰지 않는다.
  루트 해설이 평어체라 여기가 경어체면 한 트리 안에서 말투가 갈린다.
- 면접에서 한 단계 더 들어오는 지점을 짚어준다.
- 이 노드는 여러 경로에서 도달할 수 있다. 특정 부모 질문에만 통하는 서술을 피하고
  문장만 봐도 뜻이 통하게 쓴다.

도식 규칙 (중요):
- **줄글로 설명하면 독자가 머리로 다시 그려야 하는 것은 도식으로 낸다.**
  순서가 있으면 flow, 층이 쌓이면 stack, 둘을 견주면 표.
- 해설 하나에 도식 1~2개가 적당하다. 셋을 넘기면 글이 아니라 자료집이 된다.
  넣을 것이 없으면 안 넣는다 — 억지로 만든 도식이 없는 것보다 나쁘다.
- **도식은 첫 문단 바로 뒤에 놓는다.** 답을 한 문단으로 말하고 곧바로 보여준다.
  줄글을 두세 문단 쌓은 뒤에 놓으면 거기까지 가기 전에 읽기를 그만둔다.
  즉 답 → 도식 → 자세한 근거 순이다.
- 도식 앞이나 뒤 문단에서 그 도식이 무엇을 보여주는지 한 문장으로 잇는다.
  덩그러니 두면 왜 거기 있는지 모른다.

순서 (flow) — 주고받는 차례가 핵심일 때. 핸드셰이크, 요청 처리, 트랜잭션 진행.
:::flow
클라이언트 -> 서버: SYN. 연결을 열자는 요청이다
서버 -> 클라이언트: SYN + ACK. 받았고 나도 열겠다
클라이언트 -> 서버: ACK. 확인했다
:::

계층 (stack) — 위아래로 쌓인 구조가 핵심일 때. 프로토콜 계층, 메모리 영역, 캐시 단계.
위가 위층이다. \`|\` 뒤는 예시나 보조 설명이고 없어도 된다.
:::stack
애플리케이션 | HTTP, DNS
전송 | TCP, UDP
네트워크 | IP
:::

비교 — 둘 이상을 같은 잣대로 견줄 때. 표준 마크다운 표를 쓴다.
첫 열이 잣대, 나머지 열이 비교 대상이다.
**열은 세 개까지.** 폰에서 네 열이면 글자가 뭉개져 표가 오히려 안 읽힌다.
비교 축이 더 필요하면 한 칸에 두 문장으로 적는 편이 낫다.

| 기준 | 낙관적 락 | 비관적 락 |
| --- | --- | --- |
| 충돌 가정 | 드물다 | 잦다 |
| 잠금 시점 | 커밋할 때 검사 | 접근 즉시 |

도식 안에서도 굵게와 코드 표기를 쓸 수 있다.
이 셋 말고 다른 마크다운(제목, 목록, 인용, HTML, 이미지)은 쓰지 않는다.

아래가 해설 한 편의 모양이다. 답 한 문단 → 도식 → 근거 순이고 문단마다 짧다.
(주제만 다를 뿐 형태는 이대로 쓴다)

파일 디스크립터는 프로세스가 연 것을 세는 번호다. 한도가 있고, 닫지 않으면 번호가 계속 늘어 결국 새로 열 수 없다.

:::stack
프로세스 한도 | ulimit -n. 이 프로세스가 열 수 있는 수
시스템 한도 | 전체 합. 여기 걸리면 다른 프로세스도 못 연다
:::

소켓도 파일이다. 그래서 커넥션 누수는 곧 디스크립터 누수다. 응답만 읽고 닫지 않는 코드가 가장 흔한 원인이다.

한도에 닿으면 새 연결도 로그 파일도 못 연다. 서비스가 멈춘 것처럼 보이지만 CPU와 메모리는 멀쩡해서 원인을 찾는 데 시간이 걸린다.


꼬리질문(suggestions) 규칙:
- 정확히 5개.
- 각각 이 질문에서 한 단계 더 깊이 들어가는 독립된 질문이어야 한다.
- 서로 겹치지 않게 다른 방향으로 뻗는다.
- 물음표로 끝나는 한 문장. **35자를 넘기지 않는다** — 버튼과 게시판 제목에
  그대로 나가서 길면 줄이 접힌다.
- 부모 질문을 그대로 되풀이하지 않는다.`

export async function generateNodeContent(args: {
  question: string
  identityScope: string
  parentQuestion: string | null
  call?: StructuredCaller
}): Promise<{ body: string; suggestions: string[] }> {
  const call = args.call ?? realCaller

  const prompt = [
    `질문: ${args.question}`,
    `의미 범위: ${args.identityScope}`,
    args.parentQuestion ? `상위 맥락: ${args.parentQuestion}` : '상위 맥락: (없음)',
  ].join('\n')

  const out = await call({
    model: MODEL_GENERATE,
    schema: generateSchema,
    system: SYSTEM,
    prompt,
  })

  const body = out.body.trim()
  if (body.length === 0) {
    throw new Error('generation returned an empty body')
  }

  const suggestions = out.suggestions
    .map((s) => s.text.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5)

  return { body, suggestions }
}
