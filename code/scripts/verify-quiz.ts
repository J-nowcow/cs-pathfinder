import { NODE_QUIZZES, type NodeQuiz, type QuizItem } from '../data/quiz'
import { EXAMPLE_NODES, type ExampleNode } from '../data/example-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { normalizeText } from '../src/lib/expand/hash'

/**
 * 문제의 형식을 검사한다.
 *
 * 문제는 손으로 쓴 정적 자산이라 오타 하나가 조용히 끊긴다. 특히 질문 문장을
 * 고치면 `(identityScope, question)` 참조가 어긋나는데, 화면에서는 그냥
 * "문제 없는 노드"로 보여서 알아채기 어렵다.
 *
 * 실행: npm run verify:quiz
 */

type Problem = { where: string; what: string }

const KINDS = ['concept', 'misconception', 'boundary'] as const

function nodeKey(identityScope: string, question: string): string {
  return `${normalizeText(identityScope)}\n${normalizeText(question)}`
}

function collectNodes(): Map<string, ExampleNode> {
  const nodes = new Map<string, ExampleNode>()
  for (const node of [
    ...EXAMPLE_NODES,
    ...GENERATED_NODES,
    ...AUTHORED_NODES,
    ...ON_DEMAND_NODES,
  ]) {
    nodes.set(nodeKey(node.identityScope, node.question), node)
  }
  return nodes
}

/**
 * 근거가 본문에 있는지 얕게 본다.
 *
 * 완전한 판정은 자동으로 못 한다. 여기서는 영문·코드 토큰만 본다 — 한글은
 * 어미가 붙어 그대로 등장하지 않는 일이 흔해서 오탐이 쏟아진다.
 *
 * 통과했다고 맞는 것은 아니고, **걸리면 확실히 틀렸다**는 방향의 검사다.
 */
function ungroundedTokens(rationale: string, body: string): string[] {
  const tokens = rationale.match(/`[^`]+`|[A-Za-z][A-Za-z0-9_]{2,}/g) ?? []
  const haystack = body.toLowerCase()
  const missing = new Set<string>()

  for (const raw of tokens) {
    const token = raw.replace(/`/g, '').toLowerCase()
    if (token.length < 3) continue
    if (!haystack.includes(token)) missing.add(raw)
  }
  return [...missing]
}

function checkItem(item: QuizItem, node: ExampleNode, where: string): Problem[] {
  const problems: Problem[] = []

  const correct = item.choices.filter((c) => c.correct === true)
  if (correct.length !== 1) {
    problems.push({ where, what: `정답이 ${correct.length}개다. 정확히 하나여야 한다` })
  }

  if (item.choices.length < 3) {
    problems.push({ where, what: `보기가 ${item.choices.length}개다. 3개 이상이어야 한다` })
  }

  for (const [index, choice] of item.choices.entries()) {
    const at = `${where} 보기${index}`

    if (choice.correct === true && choice.leadsTo !== undefined) {
      problems.push({ where: at, what: '정답에 leadsTo가 붙었다' })
    }

    if (choice.correct !== true && choice.leadsTo === undefined) {
      problems.push({ where: at, what: '오답에 leadsTo가 없다. 어디로 보낼지 정해야 한다' })
      continue
    }

    if (choice.leadsTo === undefined) continue

    const limit = node.suggestions.length
    if (!Number.isInteger(choice.leadsTo) || choice.leadsTo < 0 || choice.leadsTo >= limit) {
      problems.push({
        where: at,
        what: `leadsTo=${choice.leadsTo}가 suggestions 범위(0~${limit - 1})를 벗어났다`,
      })
    }
  }

  const seen = new Set(item.choices.map((c) => normalizeText(c.text)))
  if (seen.size !== item.choices.length) {
    problems.push({ where, what: '같은 문장의 보기가 둘 이상이다' })
  }

  const ungrounded = ungroundedTokens(item.rationale, node.body)
  if (ungrounded.length) {
    problems.push({
      where,
      what: `근거의 ${ungrounded.join(', ')}가 본문에 없다. 본문 밖 사실을 끌어왔는지 확인할 것`,
    })
  }

  return problems
}

function checkQuiz(quiz: NodeQuiz, nodes: Map<string, ExampleNode>): Problem[] {
  const where = `[${quiz.identityScope}] ${quiz.question}`
  const node = nodes.get(nodeKey(quiz.identityScope, quiz.question))

  if (!node) {
    return [{ where, what: '이 (identityScope, question)을 가진 노드가 없다' }]
  }

  const problems: Problem[] = []

  if (quiz.items.length !== 3) {
    problems.push({ where, what: `문제가 ${quiz.items.length}개다. 세 개여야 한다` })
  }

  const kinds = new Set(quiz.items.map((i) => i.kind))
  for (const kind of KINDS) {
    if (!kinds.has(kind)) problems.push({ where, what: `${kind} 문제가 없다` })
  }

  for (const [index, item] of quiz.items.entries()) {
    problems.push(...checkItem(item, node, `${where} · 문제${index}(${item.kind})`))
  }

  return problems
}

function main() {
  const nodes = collectNodes()
  const problems: Problem[] = []
  const seenKeys = new Set<string>()

  for (const quiz of NODE_QUIZZES) {
    const key = nodeKey(quiz.identityScope, quiz.question)
    if (seenKeys.has(key)) {
      problems.push({
        where: `[${quiz.identityScope}] ${quiz.question}`,
        what: '같은 노드에 퀴즈가 두 벌이다',
      })
    }
    seenKeys.add(key)
    problems.push(...checkQuiz(quiz, nodes))
  }

  /*
   * 정답이 한 자리에 쏠리면 읽지 않고 찍어도 맞는다. 처음 쓴 1,011문제는
   * 94.6%가 1번이었다 — 손으로 쓰면 정답을 맨 위에 적게 된다.
   * 여기서 재려는 것은 무엇을 아는지이므로 찍어서 맞힌 답은 쓸모가 없다.
   */
  const positions = new Map<number, number>()
  for (const quiz of NODE_QUIZZES) {
    for (const item of quiz.items) {
      const at = item.choices.findIndex((c) => c.correct)
      positions.set(at, (positions.get(at) ?? 0) + 1)
    }
  }
  const answered = [...positions.values()].reduce((a, b) => a + b, 0)
  for (const [at, count] of [...positions].sort((a, b) => a[0] - b[0])) {
    const share = count / answered
    if (share > 0.4) {
      problems.push({
        where: '전체',
        what: `정답이 ${at + 1}번에 쏠려 있다 (${(share * 100).toFixed(1)}%)`,
      })
    }
  }

  /*
   * 길이도 답을 흘린다. 정답이 늘 가장 길면 읽지 않고 긴 것만 골라도 맞는다.
   * 아직 높아서 막지는 않고 숫자만 띄운다 — 오답을 정답과 같은 밀도로 다시
   * 쓰는 일이라 한 번에 끝나지 않는다.
   */
  let longestIsCorrect = 0
  for (const quiz of NODE_QUIZZES) {
    for (const item of quiz.items) {
      const lens = item.choices.map((c) => c.text.length)
      const at = item.choices.findIndex((c) => c.correct)
      const max = Math.max(...lens)
      if (lens[at] === max && lens.filter((l) => l === max).length === 1) longestIsCorrect++
    }
  }

  const itemCount = NODE_QUIZZES.reduce((n, q) => n + q.items.length, 0)
  console.log(`노드 ${NODE_QUIZZES.length}개 · 문제 ${itemCount}개 검사`)
  console.log(`전체 노드 ${nodes.size}개 중 ${NODE_QUIZZES.length}개에 문제가 붙어 있다`)
  const spread = [...positions]
    .sort((a, b) => a[0] - b[0])
    .map(([at, n]) => `${at + 1}번 ${((n / answered) * 100).toFixed(0)}%`)
    .join(' · ')
  console.log(`정답 위치 ${spread}`)
  console.log(
    `정답이 가장 긴 보기인 문항 ${((longestIsCorrect / itemCount) * 100).toFixed(1)}% (낮을수록 좋다)`,
  )

  if (!problems.length) {
    console.log('\n문제 없음')
    return
  }

  console.log(`\n${problems.length}건:`)
  for (const p of problems) console.log(`  ${p.where}\n    ${p.what}`)
  process.exit(1)
}

main()
