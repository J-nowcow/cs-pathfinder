import { getDb } from '@/lib/db/client'
import { newSlug } from '@/lib/tree/slug'
import { normalizeTitle, deriveSummary } from '@/lib/tree/title'
import { decodeCursor, encodeCursor, cursorPredicate, orderClause, type SortMode } from '@/lib/tree/cursor'
import type { Snapshot } from '@/lib/tree/snapshot'

/**
 * 게시판과 공유 트리 상세의 데이터 접근층.
 *
 * daily와 shared를 한 테이블에 둔 설계(§5)라 여기 있는 조회는 kind를 가리지 않는다.
 * 게시판은 오늘의 질문과 사용자 트리를 같은 코드로 줄 세운다.
 */

export type BoardTree = {
  id: string
  slug: string
  title: string
  kind: 'daily' | 'shared'
  category: string
  summary: string
  upvotes: number
  views: number
  /** ISO 8601 */
  publishedAt: string
  /** 카드가 "질문 4개"를 말할 수 있게 세어 온다 */
  nodeCount: number
}

export type TreeNode = {
  occurrenceId: string
  nodeId: string
  parentOccurrenceId: string | null
  position: number
  question: string
  category: string
}

export type TreeDetail = Omit<BoardTree, 'nodeCount'> & {
  rootNodeId: string
  nodes: TreeNode[]
}

export type CreateResult =
  | { ok: true; slug: string; title: string }
  | { ok: false; reason: 'unknown_node' | 'slug_taken' }

type TreeRow = {
  id: string
  slug: string
  title: string
  kind: 'daily' | 'shared'
  category: string
  summary: string
  upvotes: number
  views: number
  published_at: string | Date
  root_node_id: string
}

function iso(v: string | Date): string {
  return typeof v === 'string' ? new Date(v).toISOString() : v.toISOString()
}

// ── 만들기 ────────────────────────────────────────────────────────────

/**
 * 가장 깊은 줄기를 뽑는다.
 *
 * 요약에 쓴다. 트리 전체를 한 줄로 적을 수는 없으니 제일 멀리 판 길을 대표로 세운다.
 * 스냅샷 행은 이미 부모가 자식보다 앞이라 한 번 훑으면 깊이가 정해진다.
 */
function deepestTrail(snapshot: Snapshot, questionOf: Map<string, string>): string[] {
  const depth = new Map<string, number>()
  const parentOf = new Map<string, string | null>()

  let deepest = snapshot.rows[0]?.tempId ?? null
  let maxDepth = -1

  for (const row of snapshot.rows) {
    const d = row.parentTempId === null ? 0 : (depth.get(row.parentTempId) ?? 0) + 1
    depth.set(row.tempId, d)
    parentOf.set(row.tempId, row.parentTempId)

    if (d > maxDepth) {
      maxDepth = d
      deepest = row.tempId
    }
  }

  const nodeOf = new Map(snapshot.rows.map((r) => [r.tempId, r.nodeId]))
  const chain: string[] = []

  for (let cur = deepest; cur !== null && cur !== undefined; cur = parentOf.get(cur) ?? null) {
    const q = questionOf.get(nodeOf.get(cur) ?? '')
    if (q) chain.push(q)
  }

  return chain.reverse()
}

/**
 * 경로를 공유 트리로 심는다.
 *
 * **카테고리와 요약은 클라이언트가 준 값을 쓰지 않는다.** 카테고리는 게시판 필터의
 * 축이라 사용자가 정하면 아무 탭에나 끼워 넣을 수 있고, 요약은 OG 태그로 나가는
 * 문구라 남의 화면에 임의 텍스트를 띄우는 통로가 된다. 둘 다 DB에 있는 노드에서
 * 다시 읽는다. 설계 §5도 shared의 category는 루트 노드에서 상속하라고 못 박았다.
 *
 * 제목만 사용자가 정한다. 자기 트리에 이름을 붙이는 건 공유의 핵심이라 남긴다.
 */
export async function createSharedTree(input: {
  snapshot: Snapshot
  title?: string | null
}): Promise<CreateResult> {
  const db = await getDb()
  const { snapshot } = input

  const nodeIds = [...new Set(snapshot.rows.map((r) => r.nodeId))]

  // 존재하지 않거나 아직 ready가 아닌 노드가 섞이면 외래키에서 터진다.
  // 여기서 걸러야 500 대신 사유가 있는 400이 나간다.
  const known = await db.query<{ id: string; normalized_question: string; primary_category: string }>(
    `select id, normalized_question, primary_category
     from qnode where id = any($1::uuid[]) and status = 'ready'`,
    [nodeIds],
  )
  if (known.length !== nodeIds.length) return { ok: false, reason: 'unknown_node' }

  const byId = new Map(known.map((r) => [r.id, r]))
  const root = byId.get(snapshot.rootNodeId)
  if (!root) return { ok: false, reason: 'unknown_node' }

  const title = normalizeTitle(input.title, root.normalized_question)
  const summary = deriveSummary(
    deepestTrail(snapshot, new Map(known.map((r) => [r.id, r.normalized_question]))),
    snapshot.rows.length,
  )

  // occurrence UUID를 미리 뽑아둔다. 부모 id를 DB 반환값으로 풀면 행 수만큼
  // 왕복이 생기고, 트랜잭션 안에서 200번을 도는 건 링크 하나 만드는 값으로 비싸다.
  const occId = new Map(snapshot.rows.map((r) => [r.tempId, crypto.randomUUID()]))

  // slug 충돌은 2^59분의 1이라 사실상 안 나지만, 나면 링크가 남의 트리를 덮는다.
  // 재시도 세 번은 공짜고 그 사고는 복구가 안 된다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = newSlug()

    try {
      await db.transaction(async (tx) => {
        const inserted = await tx.query<{ id: string }>(
          `insert into tree (slug, title, kind, category, root_node_id, summary)
           values ($1, $2, 'shared', $3, $4, $5)
           returning id`,
          [slug, title, root.primary_category, snapshot.rootNodeId, summary],
        )
        const treeId = inserted[0].id

        // 배열 하나로 한 번에 넣는다. 부모 자기참조는 문장 끝에 검사되므로
        // 같은 문장 안에서 자식이 부모보다 먼저 나와도 문제가 없다.
        await tx.query(
          `insert into tree_occurrence (id, tree_id, qnode_id, parent_occurrence_id, position)
           select o.id, $1, o.qnode_id, o.parent_occurrence_id, o.position
           from unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::int[])
                as o(id, qnode_id, parent_occurrence_id, position)`,
          [
            treeId,
            snapshot.rows.map((r) => occId.get(r.tempId)),
            snapshot.rows.map((r) => r.nodeId),
            snapshot.rows.map((r) => (r.parentTempId ? occId.get(r.parentTempId) : null)),
            snapshot.rows.map((r) => r.position),
          ],
        )
      })

      return { ok: true, slug, title }
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
    }
  }

  return { ok: false, reason: 'slug_taken' }
}

/** Postgres 23505. PGlite는 같은 코드를 쓰고 pg는 code 필드로 준다 */
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const code = (e as { code?: unknown }).code
  return code === '23505' || /duplicate key|unique constraint/i.test(String(e))
}

// ── 읽기 ──────────────────────────────────────────────────────────────

const TREE_COLUMNS = `t.id, t.slug, t.title, t.kind, t.category, t.summary,
                      t.upvotes, t.views, t.published_at, t.root_node_id`

/**
 * 공유 트리 상세.
 *
 * occurrence를 그대로 돌려준다. 전역 qedge를 다시 걷지 않는 게 핵심이다.
 * 걷는 순간 이 트리는 박제가 아니라 지금 그래프의 그림자가 된다.
 *
 * qnode 조인에 status 조건을 걸지 않는다. 공유 시점에는 ready였던 노드가 나중에
 * 실패로 바뀌어도, 조인에서 빠지면 그 자식들이 부모 없는 행이 되어 트리가 끊긴다.
 * 여기서 쓰는 건 질문 문장뿐이라 상태와 무관하다.
 */
export async function loadTreeBySlug(slug: string): Promise<TreeDetail | null> {
  const db = await getDb()

  const rows = await db.query<TreeRow>(
    `select ${TREE_COLUMNS} from tree t where t.slug = $1`,
    [slug],
  )
  if (rows.length === 0) return null
  const t = rows[0]

  const nodes = await db.query<{
    id: string
    qnode_id: string
    parent_occurrence_id: string | null
    position: number
    normalized_question: string
    primary_category: string
  }>(
    `select o.id, o.qnode_id, o.parent_occurrence_id, o.position,
            n.normalized_question, n.primary_category
     from tree_occurrence o
     join qnode n on n.id = o.qnode_id
     where o.tree_id = $1
     order by o.position asc, o.id asc`,
    [t.id],
  )

  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    kind: t.kind,
    category: t.category,
    summary: t.summary,
    upvotes: Number(t.upvotes),
    views: Number(t.views),
    publishedAt: iso(t.published_at),
    rootNodeId: t.root_node_id,
    nodes: nodes.map((n) => ({
      occurrenceId: n.id,
      nodeId: n.qnode_id,
      parentOccurrenceId: n.parent_occurrence_id,
      position: Number(n.position),
      question: n.normalized_question,
      category: n.primary_category,
    })),
  }
}

export const BOARD_PAGE_SIZE = 12

/**
 * 게시판 한 페이지.
 *
 * limit + 1을 읽어서 다음 페이지가 있는지 본다. 별도 count 질의를 던지면 큰 테이블에서
 * 전체 스캔이 되고, 그 숫자는 어차피 화면에 안 쓴다.
 */
export async function listTrees(opts: {
  sort: SortMode
  category?: string | null
  cursor?: string | null
  limit?: number
}): Promise<{ trees: BoardTree[]; nextCursor: string | null }> {
  const db = await getDb()
  const limit = Math.min(Math.max(opts.limit ?? BOARD_PAGE_SIZE, 1), 50)

  const where: string[] = []
  const params: unknown[] = []

  if (opts.category) {
    params.push(opts.category)
    where.push(`t.category = $${params.length}`)
  }

  const pred = cursorPredicate(opts.sort, decodeCursor(opts.cursor), params.length + 1)
  if (pred.sql) {
    where.push(pred.sql)
    params.push(...pred.params)
  }

  params.push(limit + 1)

  const rows = await db.query<TreeRow & { node_count: number }>(
    `select ${TREE_COLUMNS},
            (select count(*) from tree_occurrence o where o.tree_id = t.id)::int as node_count
     from tree t
     ${where.length > 0 ? `where ${where.join(' and ')}` : ''}
     ${orderClause(opts.sort)}
     limit $${params.length}`,
    params,
  )

  const page = rows.slice(0, limit)
  const trees: BoardTree[] = page.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    category: r.category,
    summary: r.summary,
    upvotes: Number(r.upvotes),
    views: Number(r.views),
    publishedAt: iso(r.published_at),
    nodeCount: Number(r.node_count),
  }))

  const last = trees[trees.length - 1]
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({ id: last.id, publishedAt: last.publishedAt, upvotes: last.upvotes })
      : null

  return { trees, nextCursor }
}

/**
 * 조회수를 올린다.
 *
 * 없는 slug에도 조용히 넘어간다. 이 호출은 화면을 그린 뒤에 따라붙는 곁가지라
 * 여기서 던지면 멀쩡히 보이는 페이지가 에러로 뒤집힌다.
 */
export async function bumpTreeViews(slug: string): Promise<void> {
  const db = await getDb()
  await db.query('update tree set views = views + 1 where slug = $1', [slug])
}
