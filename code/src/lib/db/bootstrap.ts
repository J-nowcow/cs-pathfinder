import { getDb } from '@/lib/db/client'
import { derivedUuid } from '@/lib/db/uuid'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { isIdentityScope } from '@/lib/expand/scopes'
import { isMissingTable } from '@/lib/db/missing-table'
import { EXAMPLE_NODES, type ExampleNode } from '../../../data/example-nodes'
import { GENERATED_NODES } from '../../../data/generated-nodes'
import { AUTHORED_NODES } from '../../../data/authored-nodes'
import { ON_DEMAND_NODES } from '../../../data/on-demand-nodes'
import { QUESTION_RENAMES } from '../../../data/renames'
import { NODE_TAGS } from '../../../data/node-tags'
import { NODE_LEVELS } from '../../../data/node-levels'
import { SEED_RELATIONS, type SeedRelation } from '../../../data/relations'
import { saveRelations, type NewRelation } from '@/lib/db/relations'

export function rootNodeId(node: Pick<ExampleNode, 'identityScope' | 'question'>): string {
  return derivedUuid(`node:${node.identityScope}:${node.question}`)
}

function suggestionId(nodeId: string, position: number): string {
  return derivedUuid(`sug:${nodeId}:${position}`)
}

/**
 * 예시 루트를 삽입한다. 멱등이다.
 *
 * 계획 3의 매일 발행이 붙기 전까지 홈에 보여줄 콘텐츠이자 확장의 출발점이다.
 *
 * **본문은 갱신하고 추천은 건드리지 않는다.** 둘의 성격이 다르다.
 * 본문은 이 파일이 단일 출처인 저작 콘텐츠라 고치면 화면에 반영돼야 한다.
 * 실제로 도식을 넣었을 때 이미 시드된 노드가 옛 글을 계속 보여줬다.
 * 추천은 파생 ID를 갖고 사용자가 판 노드와 이어져 있어서, 덮으면 그 연결이
 * 가리키던 자리가 어긋난다.
 *
 * 내용이 같으면 아무것도 쓰지 않는다. 부팅마다 도는 코드라 매번 쓰면
 * 콜드 스타트에 쓸모없는 왕복이 붙는다.
 */
export async function seedExampleNodes(): Promise<{ inserted: number; refreshed: number }> {
  const db = await getDb()
  let inserted = 0
  let refreshed = 0

  /*
   * 손으로 쓴 것과 생성된 것을 함께 심는다.
   *
   * 파일은 나눠 둔다 — example-nodes.ts는 생성 규칙의 기준선이고 시험이 그것을
   * 상대로 걸려 있다. 심을 때는 둘 다 화면에 나가는 콘텐츠라 차이가 없다.
   *
   * 손으로 쓴 것을 먼저 심는다. 같은 질문이 양쪽에 있으면 손으로 쓴 쪽이
   * 남아야 한다.
   */
  /*
 * `ON_DEMAND_NODES`는 사용자가 물어보다 만들어져 DB에만 남아 있던 글이다.
 * 여기 넣어야 파일이 진짜 출처가 된다. 빼면 그 26편은 다시 고칠 파일이
 * 없는 상태로 돌아간다 -- tests/db/bodies-have-a-home.test.ts가 지킨다.
 */
/*
   * **이미 있는 행은 질문으로 찾는다. id로 찾으면 못 만난다.**
   *
   * 시드는 id를 질문 해시에서 만든다. 그런데 사용자가 물어봐서 생긴 행은
   * 그 경로가 아니라 임의의 uuid로 만들어졌다. 그래서 같은 질문인데 id가
   * 달라 `on conflict (id)`가 안 걸리고 **행이 하나 더 생긴다.**
   *
   * 실제로 그랬다. 26편을 파일로 꺼내 시드에 넣었더니 291행이 317행이 됐다.
   * 화면은 옛 행(`/q/21`)을 계속 내보내고 고친 글은 새 행(`/q/292`)에만
   * 들어갔다. 고쳤는데 아무것도 안 바뀌는 상태였다.
   *
   * 그래서 질문으로 먼저 찾는다. 있으면 그 행의 id를 쓴다 -- 짧은 주소가
   * 그대로 살아 있어야 한다.
   */
  const existing = new Map<string, string>()
  {
    const rows = await db.query<{ id: string; q: string }>(
      `select id, normalized_question q from qnode`,
    )
    /* 같은 질문이 여럿이면 번호가 작은 쪽, 즉 먼저 생긴 쪽을 남긴다 */
    for (const r of rows) if (!existing.has(r.q.trim())) existing.set(r.q.trim(), r.id)
  }

  /* 지금 붙어 있는 꼬리질문. 다른 것만 쓰려고 미리 읽는다 */
  const suggestionText = new Map<string, string>()
  {
    const rows = await db.query<{ qnode_id: string; position: number; text: string }>(
      `select qnode_id, position, text from qnode_suggestion`,
    )
    for (const r of rows) suggestionText.set(`${r.qnode_id}:${r.position}`, r.text)
  }

  /*
   * **제목을 바꾼 것은 옛 제목으로 찾는다.**
   *
   * 위 지도는 지금 저장된 제목으로 만들어져 있다. 파일에서 제목만 고치면
   * 여기서 못 찾고 새 행이 하나 더 생긴다 -- 옛 행은 옛 제목으로 목록에
   * 그대로 남는다. 26편을 꺼냈을 때 그렇게 291행이 317행이 됐다.
   *
   * `data/renames.ts`에 옛 제목을 적어 두면 그 행을 찾아 제목만 고친다.
   * 번호와 주소가 살아 있고 판 경로도 안 끊긴다.
   */
  const renamedFrom = new Map<string, string[]>()
  for (const rename of QUESTION_RENAMES) {
    const target = rename.to.trim()
    renamedFrom.set(target, [...(renamedFrom.get(target) ?? []), rename.from.trim()])
  }
  /* 태그 원본은 data/node-tags.ts다. 질문 키로 조인해 컬럼을 채운다 */
  const tagsByQuestion = new Map(NODE_TAGS.map((t) => [t.question.trim(), t.tags]))
  const levelByQuestion = new Map(NODE_LEVELS.map((l) => [l.question.trim(), l.level]))

  for (const ex of [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]) {
    const q = ex.question.trim()
    const oldId = renamedFrom.get(q)?.map((old) => existing.get(old)).find((candidate) => candidate != null)
    const id = existing.get(q) ?? oldId ?? rootNodeId(ex)

    /*
     * **`origin`도 함께 `batch`로 올린다.**
     *
     * 그 열은 목록·지도·공개 말뭉치가 "내보내도 되는가"를 판단하는 데 쓴다
     * (`db/catalog.ts` 주석: "`ready`는 생성이 끝났다는 뜻이지 공개해도 된다는
     * 뜻이 아니다"). 옳은 구분이다.
     *
     * 그런데 **정적 파일에 담겼다는 것이 곧 그 공개 판단이다.** 사람이 읽고
     * 고쳐 파일에 옮겼으면 나머지와 다를 것이 없다. 그 표시를 여기서 붙인다.
     *
     * 안 붙이면 이렇게 된다 -- 26편을 추려 넣었는데 그중 17편이 `/questions`
     * 목록에도, 지도에도, 공개 말뭉치에도 없고 주소로만 닿는다.
     */
    // xmax = 0 이면 방금 넣은 행이다. 갱신된 행과 구별하는 표준 수법이다.
    const rows = await db.query<{ id: string; created: boolean }>(
      `insert into qnode
         (id, identity_scope, normalized_question, body, primary_category, status, origin, tags, level)
       values ($1, $2, $3, $4, $5, 'ready', 'batch', $6, $7)
       on conflict (id) do update set body = excluded.body, origin = 'batch',
         normalized_question = excluded.normalized_question,
         primary_category = excluded.primary_category,
         tags = excluded.tags,
         level = excluded.level
         where qnode.body is distinct from excluded.body
            or qnode.origin <> 'batch'
            or qnode.normalized_question is distinct from excluded.normalized_question
            or qnode.primary_category is distinct from excluded.primary_category
            or qnode.tags is distinct from excluded.tags
            or qnode.level is distinct from excluded.level
       returning id, (xmax = 0) as created`,
      [id, ex.identityScope, ex.question, ex.body, ex.category, tagsByQuestion.get(q) ?? [], levelByQuestion.get(q) ?? null],
    )

    const created = rows.length > 0 && rows[0].created
    if (rows.length > 0 && !created) refreshed += 1
    if (created) inserted += 1

    /*
     * **번호는 여기서 붙인다. insert에 맡기면 안 된다.**
     *
     * 위 `insert ... on conflict`에 `number`를 안 적으면 컬럼 기본값이
     * 충돌 검사보다 **먼저** 평가된다. 이미 있는 행이어도 `nextval`이 돌고,
     * 시퀀스는 트랜잭션을 안 타므로 되돌지도 않는다. 부팅 한 번에 시드
     * 개수만큼 번호가 사라졌다 -- 283행에 29,480개를 태웠다.
     *
     * `0011`에서 기본값을 뗐다. 그래서 여기서 붙인다. `created`가 참일 때만
     * 도므로 이미 있는 행은 번호를 안 먹는다.
     */
    if (created) {
      await db.query(
        `update qnode set number = nextval('qnode_number_seq')
          where id = $1 and number is null`,
        [id],
      )
    }

    /*
     * **꼬리질문은 본문이 안 바뀌어도 고쳐야 한다.**
     *
     * 예전에는 이 자리가 새로 만든 행에서만 돌았고 충돌하면 `do nothing`이었다.
     * 그래서 이미 있는 행의 단추는 **영영 안 바뀌었다.** 35자를 넘거나 경어체인
     * 단추 44개를 고쳤는데 화면에는 옛 글자가 그대로 나왔다.
     *
     * 다만 291편 곱하기 다섯이면 매 부팅에 1,400번 넘게 쓴다. 그래서 미리
     * 한 번 읽어 두고 **다른 것만** 쓴다.
     */
    for (const [position, text] of ex.suggestions.entries()) {
      if (suggestionText.get(`${id}:${position}`) === text) continue
      await db.query(
        `insert into qnode_suggestion (id, qnode_id, text, position, target_node_id)
         values ($1, $2, $3, $4, null)
         on conflict (qnode_id, position) do update set text = excluded.text`,
        [suggestionId(id, position), id, text, position],
      )
    }

    /*
     * alias가 있어야 같은 질문이 자유 입력으로 들어왔을 때 캐시에 걸린다.
     *
     * **스코프가 스키마 밖이면 두 벌을 단다.** 시드 249개 중 53개(21%)가
     * `distributed`·`css`·`jpa` 같은 목록 밖 값을 쓴다. 그런데 게이트는
     * (`llm/gate.ts`) 목록 밖 값을 받으면 `generic`으로 강제한다. 해시가
     * 스코프를 포함하므로 시드가 단 해시와 게이트가 찾을 해시가 영영 다르다.
     *
     * 실제로 재현했다. "분산 시스템에서 CAP 중 무엇을 포기하게 되는가?"는
     * 시드 해시가 31fc5e35…, 게이트 해시가 5b0c0310…이다. 사용자가 같은 질문을
     * 입력하면 캐시를 못 타고 새 노드가 생긴다 — 같은 질문을 두 번 만들지
     * 않는다는 이 서비스의 비용 급소가 그 21%에 대해 깨져 있었다.
     *
     * 데이터의 스코프를 고치는 쪽이 근본이지만 그러면 노드 id가 바뀐다.
     * id는 (스코프 + 질문)에서 파생하므로 53개의 URL이 통째로 갈리고, 이미
     * 공유된 링크가 죽는다. alias를 하나 더 다는 것은 URL을 안 건드리면서
     * 게이트가 찾을 자리를 채운다. 별칭 표는 원래 그러라고 있는 것이다.
     */
    const hashes = new Set([questionHash(ex.identityScope, ex.question)])
    if (!isIdentityScope(ex.identityScope)) hashes.add(questionHash('generic', ex.question))

    for (const hash of hashes) {
      await db.query(
        `insert into qnode_alias (normalizer_version, normalized_hash, qnode_id)
         values ($1, $2, $3)
         on conflict (normalizer_version, normalized_hash) do nothing`,
        [NORMALIZER_VERSION, hash, id],
      )
    }
  }

  return { inserted, refreshed }
}

/**
 * 의미 관계를 심는다. 멱등이다.
 *
 * 관계는 (범위, 질문) 쌍으로 적혀 있다. 파생 id로 바로 계산하지 않고 DB에서
 * 찾는다. 파생 규칙을 두 곳에 두면 한쪽만 바뀌었을 때 선이 조용히 사라진다.
 * 찾는 비용은 부팅당 한 번의 질의다.
 *
 * **못 찾은 것을 세어 돌려준다.** 질문 문장을 고치면 여기가 어긋나는데, 조용히
 * 넘어가면 선이 사라진 것을 아무도 모른다. 세어 두면 부를 쪽에서 알아챌 수 있다.
 */
export async function seedRelations(rels: SeedRelation[]): Promise<{ inserted: number; missing: number }> {
  if (rels.length === 0) return { inserted: 0, missing: 0 }

  const db = await getDb()

  // 한 번에 다 찾는다. 관계마다 질의를 날리면 249개에 수백 번이다
  const wanted = new Set(rels.flatMap((r) => [`${r.fromScope}::${r.fromQuestion}`, `${r.toScope}::${r.toQuestion}`]))
  const rows = await db.query<{ id: string; scope: string; question: string }>(
    `select id, identity_scope as scope, normalized_question as question from qnode`,
  )
  const idOf = new Map<string, string>()
  for (const r of rows) {
    const key = `${r.scope}::${r.question}`
    if (wanted.has(key)) idOf.set(key, r.id)
  }

  const ready: NewRelation[] = []
  let missing = 0
  for (const r of rels) {
    const from = idOf.get(`${r.fromScope}::${r.fromQuestion}`)
    const to = idOf.get(`${r.toScope}::${r.toQuestion}`)
    if (!from || !to) {
      missing += 1
      continue
    }
    ready.push({ fromId: from, toId: to, kind: r.kind, source: 'llm', reason: r.reason, votes: r.votes })
  }

  await saveRelations(ready)
  return { inserted: ready.length, missing }
}

let seeding: Promise<void> | null = null

/**
 * 앱 진입점에서 부른다. 프로세스당 1회만 돈다.
 *
 * 불리언 플래그를 쓰면 첫 호출이 끝나기 전에 도착한 두 번째 요청이 그대로 통과한다.
 * promise를 캐싱해야 동시 요청이 같은 작업을 기다린다.
 */
export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    // 질문을 먼저 심는다. 관계는 질문을 찾아 잇는 것이라 순서가 뒤집히면 전부 못 찾는다
    seeding = seedExampleNodes()
      .then(() => seedRelations(SEED_RELATIONS))
      .then(({ missing }) => {
        // 질문 문장을 고치면 여기가 어긋난다. 화면은 멀쩡해 보이고 선만 사라진다
        if (missing > 0) console.warn(`[seed] 관계 ${missing}개가 가리키는 질문을 못 찾았다`)
      })
      /*
       * 관계 표가 없어도 부팅은 끝난다.
       *
       * 관계는 질문 위에 얹는 덤이다. 그런데 이 단계가 터지면서 `ensureSeeded`가
       * 실패했고, 그것을 await하는 화면 전부가 500이 됐다 — 마이그레이션 0009를
       * 프로덕션에 적용하지 않은 채 배포한 날 실제로 그랬다.
       *
       * 덤이 본체를 죽이면 안 된다. 다른 실패는 그대로 던진다.
       */
      .catch((e: unknown) => {
        if (!isMissingTable(e)) throw e
        console.warn('[seed] semantic_relation이 없다. 관계 없이 띄운다 — npm run db:migrate')
      })
      .catch((e) => {
        // 실패를 캐싱하면 다음 요청이 영영 빈 화면을 본다.
        seeding = null
        throw e
      })
  }
  return seeding
}

/** 테스트 격리용. truncate 후 시드를 다시 돌릴 수 있게 한다. */
export function resetSeedCache(): void {
  seeding = null
}
