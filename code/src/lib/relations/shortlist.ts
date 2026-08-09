import type { JudgeNode } from '@/lib/relations/judge'
import { RELATION_MIN_SIMILARITY } from '@/lib/embed/model'

/**
 * 판정에 물어볼 후보를 추린다.
 *
 * 전부 물어볼 수 없다. 249개면 프롬프트가 10KB고 몇 천 개가 되면 아예 못 넣는다.
 * 그보다 후보가 많을수록 판정이 헐거워진다 — 고를 것이 많으면 아무거나 고른다.
 *
 * **카테고리로만 자르지 않는다.** 네트워크와 모바일은 실제로 이어지는데,
 * 카테고리 안에 가두면 그 선이 영영 안 생긴다. 분야를 넘는 선을 만드는 것이
 * 이 층을 만든 이유의 절반이다.
 *
 * 대신 낱말이 겹치는지를 본다. 싸고, 분야를 안 가리고, 겹치는 낱말이 하나도
 * 없는 쌍은 물어봐야 "관계 없음"이 돌아온다.
 */

/**
 * 어느 질문에나 있는 말.
 *
 * 이것으로 이으면 모든 질문이 모든 질문과 이어진다. 실제로 우리 질문 249개는
 * 전부 물음표로 끝나고 대부분 "무엇/왜/어떻게"를 포함한다.
 */
const STOP = new Set([
  '무엇',
  '어떻게',
  '언제',
  '어디',
  '누구',
  '이유',
  '경우',
  '차이',
  '방법',
  '동작',
  '사용',
  '필요',
  '발생',
  '문제',
  '방식',
  '기준',
  '역할',
  '설명',
  '정의',
  '의미',
])

/**
 * 붙는 조사.
 *
 * "인덱스는"과 "인덱스가"를 다른 낱말로 세면 겹치는 것이 거의 없어진다.
 * 형태소 분석기를 붙일 만한 자리는 아니다 — 여기서 하는 일은 후보를 추리는
 * 것이고, 놓쳐도 판정이 한 번 덜 돌 뿐이다.
 *
 * 긴 것부터 벗긴다. "에서는"을 "는"으로 먼저 자르면 "에서"가 남는다.
 */
const PARTICLES = [
  '에서는',
  '에서',
  '으로',
  '에게',
  '까지',
  '부터',
  '보다',
  '한테',
  '이라',
  '라고',
  '는',
  '은',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '와',
  '과',
  '도',
  '만',
  '로',
]

function stripParticle(w: string): string {
  // 낱말이 조사만 남을 만큼 짧으면 벗기지 않는다. "이"를 벗기면 빈 문자열이다
  for (const p of PARTICLES) {
    if (w.length > p.length + 1 && w.endsWith(p)) return w.slice(0, -p.length)
  }
  return w
}

/** 질문에서 견줄 만한 낱말만 남긴다 */
export function tokenize(question: string): string[] {
  const out: string[] = []
  for (const raw of question.toLowerCase().split(/[^0-9a-z가-힣]+/)) {
    if (!raw) continue
    const w = stripParticle(raw)
    if (w.length < 2) continue
    if (STOP.has(w)) continue
    out.push(w)
  }
  return [...new Set(out)]
}

export type ShortlistOpts = {
  /** 몇 개까지 물어볼 것인가 */
  limit?: number
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

/**
 * 벡터로 추린다.
 *
 * **낱말 겹침이 놓치던 것을 잡는다.** 아래 `shortlist`는 `score === 0`인
 * 쌍을 후보에서 **아예 뺀다.** 그런데 같은 분야면 카테고리 가산점 1점이
 * 붙으므로 0이 안 된다. 그래서 실제로 빠지는 것은
 * **"낱말도 안 겹치고 분야도 다른 쌍"**이다.
 *
 * 하필 그것이 이 층을 만든 이유다. 아래 주석이 그렇게 적어 뒀다 --
 * "네트워크와 모바일은 실제로 이어지는데, 카테고리 안에 가두면 그 선이
 * 영영 안 생긴다." 분야를 넘으려고 둔 장치가 정확히 분야를 넘는 쌍을
 * 막고 있었다.
 *
 * 낱말 방식은 같은 저장소가 이미 반증했다. 질문 형식을 통일해 놔서 주제가
 * 아니라 **문장 틀**이 잡힌다 -- `"샤딩 키는 무엇을 기준으로 고르는가"`와
 * `"배포 방식은 무엇을 기준으로 고르는가"`가 이어졌다.
 *
 * 카테고리 가산점은 안 준다. 벡터가 이미 주제를 보고, 분야를 넘는 선을
 * 만드는 것이 이 층의 목적이기 때문이다.
 */
function byVector(focus: JudgeNode, pool: JudgeNode[], limit: number): JudgeNode[] {
  const fv = focus.embedding!
  const scored: Array<{ node: JudgeNode; score: number }> = []

  for (const c of pool) {
    if (c.id === focus.id || !c.embedding) continue
    const sim = cosine(fv, c.embedding)
    if (sim < RELATION_MIN_SIMILARITY) continue
    scored.push({ node: c, score: sim })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id))
    .slice(0, limit)
    .map((s) => s.node)
}

/**
 * 후보를 고른다.
 *
 * 점수는 겹치는 낱말 수다. 같은 카테고리면 1점을 얹는다. 얹는 이유는 같은 분야가
 * 실제로 자주 이어지는데 표현이 달라 낱말이 안 겹치는 일이 흔해서다. 1점만
 * 얹으므로, 낱말이 둘 이상 겹치는 다른 분야 질문이 같은 분야 질문을 이긴다.
 *
 * 동점이면 id 순이다. 순서가 흔들리면 잘라내는 자리가 회차마다 달라지고,
 * 그러면 같은 조건에서 판정이 달라진다. 이미 판정이 흔들리는 것을 봤으므로
 * 여기서까지 흔들 이유가 없다.
 */
export function shortlist(focus: JudgeNode, pool: JudgeNode[], opts: ShortlistOpts = {}): JudgeNode[] {
  const limit = opts.limit ?? 24

  /*
   * 벡터가 있으면 벡터로 간다.
   *
   * 아래 낱말 방식을 **지우지 않는다.** 임베딩이 안 담긴 노드가 섞일 수 있고
   * (새로 생긴 노드는 밤 배치 전까지 비어 있다), 두 방식이 뽑은 후보를
   * 견줘 볼 수 있어야 바꾼 것이 나은지 판단할 수 있다.
   */
  if (focus.embedding && pool.some((c) => c.embedding)) {
    return byVector(focus, pool, limit)
  }

  const focusWords = new Set(tokenize(focus.question))

  const scored: Array<{ node: JudgeNode; score: number }> = []
  for (const c of pool) {
    if (c.id === focus.id) continue

    let overlap = 0
    for (const w of tokenize(c.question)) if (focusWords.has(w)) overlap += 1

    const score = overlap + (c.category === focus.category ? 1 : 0)
    if (score === 0) continue
    scored.push({ node: c, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id))
    .slice(0, limit)
    .map((s) => s.node)
}
