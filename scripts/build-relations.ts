import { loadEnvLocal } from '../src/lib/load-env'

// import보다 먼저 돌아야 한다. 키를 읽는 모듈이 아래에 있다
loadEnvLocal()

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { shortlist } from '../src/lib/relations/shortlist'
import { judgeRelations, type JudgeNode } from '../src/lib/relations/judge'
import type { RelationKind } from '../src/lib/db/relations'

/**
 * 질문 사이의 의미 관계를 만든다.
 *
 * 결과를 `data/relations.ts`에 적는다. 화면이 쓰는 DB는 배포마다 새로 만들어지는
 * PGlite라 여기서 만든 것을 DB에 바로 넣어봐야 사라진다. 질문 자체도 같은 이유로
 * 데이터 파일에 있다.
 *
 * 판정은 회차마다 흔들린다. 그래서 판정기가 안에서 세 번 뽑아 다수결을 낸다.
 * 여기서는 그 결과만 받는다.
 *
 * 실행:
 *   npx tsx scripts/build-relations.ts               # 이어서 하기
 *   npx tsx scripts/build-relations.ts --from 100    # 100번째 질문부터
 *   npx tsx scripts/build-relations.ts --limit 20    # 20개만
 */

const OUT = 'data/relations.ts'
const CACHE = '/tmp/cs-relations.json'

type Row = {
  fromScope: string
  fromQuestion: string
  toScope: string
  toQuestion: string
  kind: RelationKind
  reason: string
  votes: number
}

const arg = (name: string): number | null => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : null
}

const ALL = [...EXAMPLE_NODES, ...GENERATED_NODES]

/*
 * 판정에는 질문과 카테고리만 필요하다. id는 여기서만 쓰는 임시 번호다 —
 * 진짜 노드 id는 시드할 때 (범위, 질문)에서 파생된다. 판정 프롬프트에 uuid를
 * 넣으면 36자짜리가 후보 수만큼 붙어 프롬프트가 두 배가 된다.
 */
const nodes: JudgeNode[] = ALL.map((n, i) => ({
  id: `q${i}`,
  question: n.question,
  category: n.category,
}))
const byId = new Map(nodes.map((n, i) => [n.id, ALL[i]]))

/*
 * 하다 만 것을 이어서 한다. 249개면 회차 3번씩 747번 호출이라 한 번에 끝나지
 * 않는다. 무료 한도가 마르면 건당 2분까지 간다.
 */
const done: Row[] = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : []
const judged = new Set(done.map((r) => `${r.fromScope}::${r.fromQuestion}`))

const from = arg('--from') ?? 0
const limit = arg('--limit') ?? nodes.length
const targets = nodes.slice(from, from + limit)

console.log(`질문 ${nodes.length}개 · 이번에 볼 것 ${targets.length}개 · 이미 한 것 ${judged.size}개`)

let asked = 0
for (const focus of targets) {
  const src = byId.get(focus.id)!
  if (judged.has(`${src.identityScope}::${src.question}`)) continue

  const cands = shortlist(focus, nodes)
  if (cands.length === 0) {
    judged.add(`${src.identityScope}::${src.question}`)
    continue
  }

  let rels
  try {
    rels = await judgeRelations(focus, cands)
  } catch (e) {
    console.log(`  ! ${focus.question} — ${(e as Error).message}`)
    continue
  }

  for (const r of rels) {
    const dst = byId.get(r.toId)
    if (!dst) continue
    done.push({
      fromScope: src.identityScope,
      fromQuestion: src.question,
      toScope: dst.identityScope,
      toQuestion: dst.question,
      kind: r.kind,
      reason: r.reason,
      votes: r.votes,
    })
  }

  judged.add(`${src.identityScope}::${src.question}`)
  asked += 1
  writeFileSync(CACHE, JSON.stringify(done, null, 2))
  console.log(`  ${asked}/${targets.length} ${focus.question} → ${rels.length}개 (후보 ${cands.length})`)
}

const q = (s: string) => JSON.stringify(s)
const lines = [
  '/**',
  ' * 질문 사이의 의미 관계.',
  ' *',
  ' * "같은 질문인가"가 아니라 "관련 있는가"다. 꼬리질문이 기존 질문과 같은 경우는',
  ' * 5%뿐이라 같음만으로는 선이 안 생긴다.',
  ' *',
  ' * 노드 id 대신 (범위, 질문)으로 적는다. id는 그 둘에서 파생되므로 같은 것을',
  ' * 가리키고, 이쪽이 사람이 읽고 고칠 수 있다.',
  ' *',
  ' * scripts/build-relations.ts가 만든다. 손으로 고치지 않는다.',
  ' */',
  'export type SeedRelation = {',
  '  fromScope: string',
  '  fromQuestion: string',
  '  toScope: string',
  '  toQuestion: string',
  "  kind: 'shares_concept' | 'prerequisite' | 'alternative' | 'instance_of'",
  '  reason: string',
  '  votes: number',
  '}',
  '',
  'export const SEED_RELATIONS: SeedRelation[] = [',
]
for (const r of done) {
  lines.push(
    `  { fromScope: ${q(r.fromScope)}, fromQuestion: ${q(r.fromQuestion)}, toScope: ${q(r.toScope)}, toQuestion: ${q(r.toQuestion)}, kind: ${q(r.kind)}, reason: ${q(r.reason)}, votes: ${r.votes} },`,
  )
}
lines.push(']', '')
writeFileSync(OUT, lines.join('\n'))

const byKind = new Map<string, number>()
for (const r of done) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1)
const linked = new Set(done.flatMap((r) => [r.fromQuestion, r.toQuestion]))

console.log(`\n관계 ${done.length}개 · 선이 닿은 질문 ${linked.size}/${nodes.length}개`)
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
