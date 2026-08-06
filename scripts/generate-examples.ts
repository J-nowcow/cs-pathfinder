import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { generateDailyRoot } from '../src/lib/daily/generate'
import {
  callWithFallback,
  type StructuredCaller,
  type StructuredCallArgs,
} from '../src/lib/llm/client'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { questionFormIssues } from '../src/lib/llm/question-form'

/**
 * 주제 목록에서 예시 노드를 만든다.
 *
 * 공개 저장소(VSFe/Tech-Interview, gyoogle/tech-interview-for-developer)에서
 * 주제를 모으고 기존 시드와 겹치는 것을 뺀 목록을 입력으로 받는다.
 *
 * **남의 질문 문장을 그대로 옮기지 않는다.** 주제어만 넘기고 문장은 우리
 * 프롬프트가 새로 쓴다. 그쪽은 경어체 서술형("~에 대해 설명해 주세요")이라
 * 우리 형식(평어체 의문형·40자)과 애초에 다르고, 남이 큐레이션한 문장을
 * 그대로 가져오는 것도 피하는 편이 맞다.
 *
 * 201건이라 중간에 끊길 수 있다. 한 건 끝날 때마다 파일에 쓴다. 다시 돌리면
 * 이미 만든 것은 건너뛴다.
 *
 * 실행: npm run gen:examples [개수]
 */
type Topic = { src: string; category: string; topic: string }
type Made = Topic & {
  question: string
  identityScope: string
  body: string
  summary: string
  suggestions: string[]
  issues: string[]
}

const IN = '/tmp/cs-harvest/topics.json'

/**
 * 조각 나눠 돌리기.
 *
 * 한도가 마르면 사슬 끝의 느린 모델이 답해서 건당 2분까지 간다. 201건이면
 * 여섯 시간이다. 기다리는 시간이 대부분 네트워크라 나눠서 동시에 돌리면
 * 그만큼 줄어든다.
 *
 * 조각마다 파일을 따로 쓴다. 한 파일에 여럿이 쓰면 나중에 쓴 쪽이 앞의 것을
 * 덮어서 조용히 사라진다.
 *
 * 실행: npm run gen:examples -- --shard 0/4
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}
const shard = arg('--shard')
const [part, of] = shard ? shard.split('/').map(Number) : [0, 1]
const OUT = shard
  ? `/tmp/cs-harvest/generated-${part}.json`
  : '/tmp/cs-harvest/generated.json'

/**
 * 만들어진 것이 규칙을 지키는지 본다.
 *
 * 여기서 걸린 것은 버리지 않고 표시만 해 둔다. 무엇이 얼마나 어긋나는지
 * 세어봐야 프롬프트를 고칠지 사람이 손볼지 정할 수 있다.
 */
function check(m: Omit<Made, 'issues'>): string[] {
  const out: string[] = []

  out.push(...questionFormIssues(m.question).map((i) => `question:${i}`))
  if (m.question.length > 40) out.push(`question:${m.question.length}자`)

  const blocks = parseBlocks(m.body)
  const first = blocks.findIndex((b) => b.type !== 'paragraph')
  if (first < 0) out.push('도식없음')
  else if (first >= 3) out.push(`도식위치:${first}`)

  for (const b of blocks) {
    if (b.type !== 'paragraph') continue
    if (b.text.includes(':::') || b.text.includes('```')) out.push('울타리누출')
    if (b.text.length > 150) out.push(`긴문단:${b.text.length}`)
  }

  if (m.suggestions.length !== 5) out.push(`꼬리질문수:${m.suggestions.length}`)
  for (const s of m.suggestions) {
    if (s.length > 35) out.push(`긴꼬리질문:${s.length}`)
    if (questionFormIssues(s).length > 0) out.push('꼬리질문형식')
  }
  return out
}

/** 손발행과 같은 이유로 넉넉하게 잡는다. 한도가 마르면 느린 모델이 답한다 */
const patient: StructuredCaller = <T,>(a: StructuredCallArgs<T>): Promise<T> =>
  callWithFallback(a, { attemptTimeoutMs: 120_000 })

const topics: Topic[] = JSON.parse(readFileSync(IN, 'utf8'))
const made: Made[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : []
const done = new Set(made.map((m) => m.topic))

const mine = topics.filter((_, i) => i % of === part)
const limit = Number(arg('--limit') ?? mine.length)
const todo = mine.filter((t) => !done.has(t.topic)).slice(0, limit)

console.log(`주제 ${topics.length}개 · 이미 만든 것 ${made.length}개 · 이번에 ${todo.length}개`)

let ok = 0
let flagged = 0
let failed = 0

for (const [i, t] of todo.entries()) {
  const head = `[${i + 1}/${todo.length}] ${t.topic.slice(0, 32)}`
  try {
    const content = await generateDailyRoot({
      term: t.topic,
      category: t.category,
      call: patient,
    })
    const row: Made = { ...t, ...content, issues: [] }
    row.issues = check(row)

    made.push(row)
    writeFileSync(OUT, JSON.stringify(made, null, 1))

    if (row.issues.length === 0) {
      ok += 1
      console.log(`${head} — OK · ${row.question.slice(0, 30)}`)
    } else {
      flagged += 1
      console.log(`${head} — ${row.issues.join(',')} · ${row.question.slice(0, 26)}`)
    }
  } catch (e) {
    failed += 1
    console.log(`${head} — 실패: ${e instanceof Error ? e.message.slice(0, 50) : e}`)
  }
}

console.log(`\n깨끗 ${ok} · 표시됨 ${flagged} · 실패 ${failed} · 누적 ${made.length}개`)
process.exit(0)
