/**
 * 해설 문장이 사람이 쓴 것처럼 읽히는지 본다.
 *
 * 프롬프트가 이미 금지하고 있는 것들이다. 그런데 재보니 생성된 219개 중
 * 18%가 `~를 통해`, 19%가 `~할 수 있다`를 쓰고 있었다. 손으로 쓴 30개는
 * 0%와 3%였다. 기준선은 지켜지는데 생성본만 안 지켜진다는 뜻이고, 이유는
 * 간단하다 — **아무것도 검사하지 않았다.**
 *
 * 다른 규칙(질문 40자·꼬리질문 35자·도식 위치·문단 150자)은 전부 검사기가
 * 있는데 문체 규칙만 프롬프트에만 적혀 있었다. 검사하지 않는 규칙은 규칙이
 * 아니라 바람이다.
 */

export type ProseIssue = string

/** 번역투. "~를 통해 ~한다"는 영어 by/through를 그대로 옮긴 자리다 */
const TRANSLATIONESE = /(를|을)\s*통해/

/*
 * "~할 수 있다"와 "쉼표로 이은 문장"은 여기서 안 잡는다.
 *
 * 처음에는 둘 다 넣었다가 손으로 쓴 30개를 상대로 돌려보고 뺐다. 기준선이
 * 네 군데 걸렸는데 전부 검사기가 틀린 쪽이었다.
 *
 *   "마지막 ACK가 유실될 수 있기 때문이다"      진짜 가능성이다. 얼버무림이 아니다
 *   "푸시는 최선 노력이라 유실될 수 있다"        같다
 *   "격리되고, 큰 프로그램이 돌고, 한 벌만 쓴다"  병렬 열거다. 좋은 문장이다
 *
 * 금지해야 할 것은 사실이나 권고를 흐리는 "빨라질 수 있다"이고, 허용해야 할
 * 것은 실제로 일어날 수도 아닐 수도 있는 일이다. 그 둘은 문장 모양이 같다.
 * 쉼표도 절을 이어 붙인 것과 열거를 길이로 갈라 보려 했으나 기준선이 반증했다.
 *
 * 기준선을 거는 검사기는 검사기가 틀린 것이다. 못 가르는 것을 억지로 가르면
 * 좋은 글을 버리게 된다. 이 둘은 사람이 읽고 판단할 몫으로 남긴다.
 */

/**
 * 접속부사로 문단을 여는 것.
 *
 * "따라서", "결론적으로"로 시작하는 문단은 앞 문단을 요약하고 넘어가는 자리인데,
 * 짧은 해설에서는 같은 말을 두 번 하게 된다.
 */
const CONNECTIVE_OPENER = /^(따라서|그러므로|결론적으로|즉,|요약하면)/

/** 과장. 해설에 감탄이 섞이면 정보가 묽어진다 */
const HYPE = /(?:(매우|아주|정말|굉장히|극도로)\s|압도적|강력한|획기적)/

/** 내용 대신 채점 상황을 말하는 결말. 독자가 필요한 것은 평가자의 행동이 아니다 */
const INTERVIEW_FRAME = /^(면접|실무)에서(?:는)?\s/

/** 문제를 되받아 추상적으로 잇는 생성문. 해결 동작의 주어를 바로 쓰는 편이 짧다 */
const FORMULAIC_BRIDGE = /이를 (해결|방지|최적화)하기 위해/

/** 그림 자체를 주어로 설명하는 메타 문장. 기술 대상을 바로 쓰는 편이 자연스럽다 */
const DIAGRAM_NARRATION = /(?:^|[.!?]\s+)(?:위|아래|이)\s+(?:표|도식|그림|흐름)(?:은|는|에서|처럼|의)/

/** 혼자 쓰이면 괜찮지만 한 문단에 겹치면 무엇이 좋아지는지 숨기는 말들 */
const VAGUE_BENEFIT = /(효율적|효과적|단순히|기반으로|활용)/g

/** 문장 하나가 이보다 길면 읽다가 앞을 잊는다 */
const MAX_SENTENCE = 90

/**
 * 문단 하나를 검사한다.
 *
 * 도식 안은 안 본다. `:::flow`의 화살표 라벨은 문장이 아니라 이름표라
 * 문장 규칙을 대면 전부 걸린다.
 */
export function proseIssues(text: string): ProseIssue[] {
  const out: ProseIssue[] = []
  if (TRANSLATIONESE.test(text)) out.push('번역투(~를 통해)')
  if (CONNECTIVE_OPENER.test(text.trim())) out.push('접속부사로 시작')
  if (HYPE.test(text)) out.push('과장')
  if (INTERVIEW_FRAME.test(text.trim())) out.push('면접 상황으로 설명')
  if (FORMULAIC_BRIDGE.test(text)) out.push('상투적 문제 해결 연결')
  if (DIAGRAM_NARRATION.test(text)) out.push('도식을 지칭하며 설명')

  const vagueBenefitCount = [...text.matchAll(VAGUE_BENEFIT)].length
  if (vagueBenefitCount >= 2) out.push('상투적 이점 표현이 겹침')

  for (const s of text.split(/(?<=[.?!])\s+/)) {
    if (s.length > MAX_SENTENCE) {
      out.push(`긴 문장(${s.length}자)`)
      break
    }
  }
  return [...new Set(out)]
}
