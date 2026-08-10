import { parseBlocks, isDivider } from '@/lib/markdown/blocks'
import { questionFormIssues } from '@/lib/llm/question-form'
import { proseIssues } from '@/lib/llm/prose'
import { staleFactIssues } from '@/lib/llm/stale-facts'

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

/** 층이 이보다 적으면 계층이 아니라 둘을 나란히 놓은 것이다 */
export const MIN_STACK_LAYERS = 3
/**
 * 표 열 수의 권장 상한.
 *
 * **막지는 않는다.** 처음에는 "폰에서 네 열이면 뭉개진다"를 근거로 막았는데,
 * 렌더러를 다시 보니 좁은 화면에서 표는 **줄 단위 카드로 접힌다**
 * (`Diagram.tsx`·`globals.css`). 열이 늘어도 카드 안의 이름표+값 한 줄이
 * 될 뿐 뭉개지지 않는다. 근거가 사라진 규칙이었다.
 *
 * 막았을 때 더 나쁜 일이 생긴다. 다시 부른 결과는 **지적 수가 줄기만 하면**
 * 채택되므로(`generate.ts`), 비교 대상 하나를 빼고 3열로 만든 답이 이긴다.
 * 읽기 편해지자고 견줄 것을 잃는다.
 */
export const MAX_TABLE_COLS = 3

/**
 * 같은 낱말이 그대로 붙어 나오는 자리.
 *
 * 실제로 나갔다. 공유받은 사람이 첫 화면에서 `스핀 락은 계속해서 **락 락**
 * 획득을 시도하는`, `전체적인 시스템 **성능이 성능이** 향상된다`를 봤다.
 * 뜻은 통하지만 읽는 사람은 고장으로 받아들인다.
 *
 * **줄바꿈을 넘지 않는다.** 넘게 했더니 stack 도식에서 오탐이 났다 —
 * `코드 | 정적 데이터` 다음 줄이 `데이터 | 전역 변수`라 `데이터\n데이터`가
 * 걸렸다. 멀쩡한 도식이다. 도식 블록 자체도 이 검사를 안 받는다.
 *
 * 음절 단위로 잡으려던 적이 있는데(`(.{1,3})\1`) 손으로 쓴 30개의 33%가
 * 걸렸다 — `사이사이`, `스스로`, `질의의`. 낱말 경계를 쓰면 기준선이 0이다.
 *
 * **한 글자짜리도 잡는다.** 처음에 두 글자 이상만 봤는데 그러면 실제로 나간
 * `락 락`을 놓친다. 한 글자까지 넓혀도 손으로 쓴 30개는 그대로 0건이었다.
 */
const REPEATED_WORD = /(?<![가-힣])([가-힣]+)[^\S\n]+\1(?![가-힣])/

/**
 * 조사가 붙은 채로 겹친 자리.
 *
 * `낱말반복`은 **띄어 쓴** 반복만 본다(`락 락`). 붙어서 깨진 것은 못 잡는다.
 * 전수 대조 결과를 읽다가 드러났다 — `신호를를 보낸다`, `행을을 찾는다`,
 * `메모리를를 나누는`. 뜻은 통하지만 읽는 사람은 고장으로 받아들인다.
 *
 * **조사를 다섯으로 좁힌 것이 이 규칙의 전부다.** 처음에는 `가·이·의·에·로·도`도
 * 넣었는데 코퍼스 16편 중 3편이 오탐이었고 그중 하나가 **손으로 쓴 기준선**에
 * 있었다.
 *
 *   대가가 분명하다   ← 대가 + 가. 멀쩡하다
 *   의도도 흐려진다   ← 의도 + 도. 멀쩡하다
 *   임의의 위치       ← 임의 + 의. 멀쩡하다
 *   속도가가 느리다   ← 속도 + 가 + 가. 깨졌다
 *
 * 앞의 셋과 마지막이 **모양이 같다.** 명사 끝 글자와 조사가 우연히 같은
 * 것뿐이라, 어디까지가 명사인지 모르면 못 가른다. 사전이 필요한 일이다.
 *
 * `를·을·는·와·과`로 끝나는 명사는 이 코퍼스에 사실상 없다. 그래서 이 다섯은
 * 겹치면 깨진 것이 맞다. 재현율을 버리고 정밀도를 산다 — `block`이라 오탐이
 * 멀쩡한 답을 다시 부르게 만든다.
 *
 * 실측: 운영 276편 중 7편이 걸리고 전부 진짜다. 손으로 쓴 30편은 0편이다.
 */
const GLUED_JOSA = /(?<=[가-힣])(를|을|는|와|과)\1(?=[\s.,)·]|$)/m

/**
 * 해설 하나를 검사한다.
 *
 * 부르는 쪽이 문단을 다시 쪼갤 필요가 없게 `parseBlocks`를 여기서 돌린다.
 * 도식 안은 문장 규칙을 안 댄다 — `:::flow`의 라벨은 문장이 아니라 이름표라
 * 문장 규칙을 대면 전부 걸린다.
 */
/**
 * 쓸 수 있는 울타리 이름. `parseBlocks`가 아는 것과 같아야 한다.
 *
 * `note`·`warn`은 도식이 아니라 콜아웃이지만 **여기서는 같이 센다.** 이 집합이
 * 두 가지 일을 하기 때문이다 — 모르는 이름을 가르는 일(`모르는울타리`)과
 * 연 개수와 그려진 개수를 견주는 일(`울타리삼킴`). 콜아웃을 빼면 앞엣것이
 * 멀쩡한 `:::note`를 없는 종류라고 막고, 뒤엣것은 열린 것을 안 그려졌다고 센다.
 *
 * **대신 `firstDiagram`이 콜아웃을 도식으로 센다.** 지금은 닿지 않는 자리다 —
 * 생성 프롬프트(`llm/generate.ts`)가 콜아웃을 가르치지 않아 모델이 쓰지 않고,
 * 손으로 쓴 편은 전부 도식이나 표를 따로 갖고 있다. **프롬프트에 콜아웃을
 * 넣는 날 이 줄을 같이 봐야 한다.** 안 보면 콜아웃 하나로 `도식없음`이
 * 조용히 통과해 도식 없는 해설이 그린 것으로 세어진다.
 */
const FENCE_NAMES = new Set([
  'flow',
  'state',
  'tree',
  'memory',
  'timeline',
  'stack',
  'note',
  'warn',
])

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

  /*
   * **울타리를 열고도 그림이 안 나온 자리.**
   *
   * 위의 `도식삼킴`은 도식이 **하나도 없을 때만** 운다. 그래서 표 하나가
   * 함께 있으면 옆에서 울타리가 통째로 사라져도 조용히 지나간다.
   *
   * 실제로 그런 편이 있었다. `:::stack` 안에 마크다운 표 구분선(`--- | ---`)이
   * 들어 있어 파서가 표로 읽고 울타리를 버렸다. 표가 남으니 `도식삼킴`이
   * 안 울었고, 317편을 훑는 검사에서 0건으로 나왔다.
   *
   * 그래서 **연 개수와 그려진 개수를 견준다.** 이름을 적어 열었으면 그 수만큼
   * 나와야 한다. 덜 나왔으면 어딘가에서 먹혔다는 뜻이다.
   */
  const opened = [...c.body.matchAll(/^:::[ \t]*([A-Za-z가-힣_-]+)/gm)].map((m) => m[1])

  /*
   * 모르는 이름을 먼저 가른다. `:::sequence`처럼 없는 종류를 쓰면 파서가
   * 통째로 버리는데, 아래 개수 비교만으로는 "문법이 틀렸다"로 읽혀 엉뚱한
   * 곳을 고치게 된다. 지금 코퍼스에 0건이지만 **새 종류를 열 때 여기가
   * 먼저 걸려야 한다.**
   */
  const unknown = [...new Set(opened.filter((n) => !FENCE_NAMES.has(n)))]
  if (unknown.length > 0) {
    out.push({
      rule: '모르는울타리',
      detail: `\`:::${unknown[0]}\`은 없는 도식 종류다. 쓸 수 있는 것은 ${[...FENCE_NAMES].join('·')}뿐이다`,
      severity: 'block',
    })
  }

  const drawn = blocks.filter((b) => FENCE_NAMES.has(b.type)).length
  if (unknown.length === 0 && opened.length > drawn) {
    out.push({
      rule: '울타리삼킴',
      detail: `울타리를 ${opened.length}개 열었는데 ${drawn}개만 그려졌다. 안에 표 구분선(\`--- | ---\`)이 들어 있거나 문법이 어긋난 것이다`,
      severity: 'block',
    })
  }

  /*
   * 교과서가 낡아서 배운 대로 쓰면 틀리는 자리.
   *
   * **여기만 형태가 아니라 내용을 본다.** 사실 확인 전체를 규칙으로 할 수는
   * 없지만, 표본 20편을 대조해 보니 틀린 것들이 한 종류로 모였다. 문장 모양이
   * 거의 정해져 있어서 그것만은 잡을 수 있다.
   *
   * 글 전체를 본다 — 주제어는 첫 문단에, 틀린 표현은 도식 안에 있는 경우가
   * 실제로 있다(`Key Exchange | 프리마스터 시크릿 전달`).
   */
  out.push(...staleFactIssues(c.body))

  /*
   * 붙어서 겹친 조사. **글 전체를 본다** — `낱말반복`이 문단만 보는 것은
   * 도식의 줄바꿈에서 오탐이 났기 때문인데, 붙어 있는 겹침은 그 문제가 없다.
   * 도식 이름표 안에서 깨져도 똑같이 고장으로 읽힌다.
   */
  const glued = GLUED_JOSA.exec(c.body)
  if (glued) {
    out.push({
      rule: '조사겹침',
      detail: `"${glued[0]}"처럼 조사가 붙은 채 겹쳤다. 그 자리를 다시 써라`,
      severity: 'block',
    })
  }

  /*
   * 계층 울타리에 표를 넣은 것.
   *
   * **파싱된 블록에서는 이제 볼 수 없다.** 파서가 구분줄을 보면 표로 다시
   * 읽으므로 그런 `stack` 블록은 만들어지지 않는다. 블록을 보는 검사는 참이
   * 될 수 없는 죽은 코드가 된다 — `usable()`로 한 번 겪은 그 함정이다.
   *
   * 그래서 원문을 본다. 화면은 파서가 고쳐 주지만 모델이 형태를 잘못 고른
   * 것은 그대로다. 그 신호까지 잃으면 프롬프트를 언제 고쳐야 할지 모른다.
   *
   * **막지는 않는다.** 그려지는 모습이 이제 옳으므로 이것 하나로 14초를 더
   * 쓰게 할 이유가 없다. 적어만 둔다.
   */
  const stackFence = /^:::\s*stack\b([\s\S]*?)^:::/m.exec(c.body)
  if (stackFence && stackFence[1].split('\n').some((l) => isDivider(l))) {
    out.push({
      rule: '표를계층에',
      detail: '계층 울타리 안에 표를 넣었다. 표는 울타리 없이 그대로 써라',
      severity: 'note',
    })
  }

  for (const b of blocks) {
    /*
     * 도식이 제 뜻에 맞게 쓰였는가.
     *
     * 실측에서 도피처가 표가 아니라 **stack**이었다. 표 127개 중 형태가 틀린
     * 것이 30개(24%)인데 stack 56개 중에서는 23개(41%)다.
     *
     * 파서가 이유를 설명한다 — `parseStack`은 거의 실패하지 않는다. 비어 있지
     * 않은 모든 줄을 층으로 받는다. flow는 화살표가 없으면 `null`, 표는
     * 구분줄이 없으면 `null`인데 stack은 대부분을 삼킨다. 그래서 모델이 형태를
     * 못 고를 때 stack 울타리에 아무거나 넣는다.
     *
     * 표를 넣은 경우는 이제 파서가 표로 되돌린다. 남은 것은 **계층이 아닌 것을
     * 계층으로 그린 경우** — 그건 문법으로는 알 수 없고 층 수로만 짐작한다.
     */
    if (b.type === 'stack') {
      if (b.layers.length < MIN_STACK_LAYERS) {
        /*
         * 2층 stack은 계층이 아니라 둘을 나란히 놓은 것이다. `웹 서버` 위에
         * `WAS`를 쌓으면 독자는 "WAS가 아래층인가"로 읽는다. 정보를 잃는
         * 정도가 아니라 **없는 계층을 만들어낸다.** 56개 중 30개가 2층이다.
         *
         * 막지는 않는다. 층이 둘뿐인 진짜 계층도 있다.
         */
        out.push({
          rule: '얕은계층',
          detail: `계층 도식이 ${b.layers.length}층뿐이다. 위아래로 쌓인 것이 아니면 표로 견줘라`,
          severity: 'note',
        })
      }
    }

    /*
     * 타임라인이 실은 순서인 경우.
     *
     * timeline이 flow와 다른 점은 하나다 — **같은 칸에 둘이 동시에 있는 것.**
     * 어느 칸에도 둘이 같이 차 있지 않으면 겹치는 것이 없다는 뜻이고, 그러면
     * 차례로 주고받는 순서라 flow가 맞다. stack이 그랬듯 timeline도 형태를
     * 못 고를 때의 도피처가 되기 쉬워서 미리 댄다.
     *
     * 막지는 않는다. 하나가 통째로 멈춰 서 있고 다른 하나만 일하는 것(블로킹
     * 입출력)도 진짜 타임라인인데, 그때는 겹치는 칸이 없다.
     */
    if (b.type === 'timeline') {
      const overlapped = b.rows[0].slots.some(
        (_, t) => b.rows.filter((r) => r.slots[t].length > 0).length >= 2,
      )
      if (!overlapped) {
        out.push({
          rule: '겹침없음',
          detail: '타임라인에 같은 칸을 함께 쓴 자리가 없다. 차례로 주고받는 것이면 flow로 써라',
          severity: 'note',
        })
      }
    }

    if (b.type === 'table') {
      if (b.head.length > MAX_TABLE_COLS) {
        out.push({
          rule: '표열수',
          detail: `표가 ${b.head.length}열이다. 견줄 대상이 많으면 표를 나누거나 축을 뒤집어라 (\`대상 | 특징 | 쓰는 때\`)`,
          severity: 'note',
        })
      }
      if (b.rows.length < 2) {
        /* 한 줄짜리 표는 견주는 것이 아니다. 문장으로 쓰는 편이 짧다 */
        out.push({
          rule: '표한줄',
          detail: '표가 한 줄뿐이다. 견줄 것이 둘 이상일 때만 표를 쓴다',
          severity: 'note',
        })
      }
    }

    if (b.type !== 'paragraph') continue

    const stutter = b.text.match(REPEATED_WORD)
    if (stutter) {
      out.push({
        rule: '낱말반복',
        detail: `"${stutter[0]}"처럼 같은 낱말이 붙어 있다. 문장을 다시 써라`,
        severity: 'block',
      })
    }

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

/** 질문 문장은 제목으로 나간다. 길면 카드와 목록에서 두 줄이 된다 */
export const MAX_QUESTION = 40

/**
 * 새로 만들어질 질문 문장을 본다.
 *
 * 배치 게이트는 이걸 검사하고 있었는데 **운영 경로는 비었는지만 봤다.**
 * 그래서 사용자가 42자짜리 꼬리질문을 눌렀더니 57자짜리 제목에 도착했다 —
 * 자기가 고른 것과 다른 질문에 온 것처럼 보인다.
 *
 * 이 문장은 노드의 신원이라 한 번 저장되면 URL과 제목에 그대로 박힌다.
 * 나중에 고치면 같은 질문이 두 개가 된다.
 */
export function questionIssues(question: string): ContentIssue[] {
  const out: ContentIssue[] = []

  if (question.length > MAX_QUESTION) {
    out.push({
      rule: '질문길이',
      detail: `질문이 ${question.length}자다. ${MAX_QUESTION}자 아래로 줄여라. 수식어를 덜어내고 핵심 명사와 동사만 남긴다`,
      severity: 'block',
    })
  }

  for (const i of questionFormIssues(question)) {
    out.push({
      rule: `질문형식:${i}`,
      detail:
        i === 'polite'
          ? '질문이 경어체다. 평어체로 써라'
          : '질문이 의문문이 아니다. 물음표로 끝나는 한 문장으로 써라',
      severity: 'block',
    })
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
