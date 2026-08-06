import { getDb } from '@/lib/db/client'

/**
 * 질문 사이의 의미 관계를 읽고 쓴다.
 *
 * `qedge`(사용자가 걸어간 길)와 섞지 않는다. 이쪽은 "A와 B는 관련 있다"이고,
 * 사람이 지나간 적 없어도 만들어진다.
 *
 * 이 층이 필요한 이유는 실측이다. 꼬리질문이 기존 질문과 **같은** 경우는 5%였다
 * (방법을 둘로 바꿔 재도 같았다). 같음만 이어서는 249개가 흩어진 점으로 남는다.
 */

export type RelationKind = 'shares_concept' | 'prerequisite' | 'alternative' | 'instance_of'
export type RelationSource = 'llm' | 'human' | 'seed'

export type NewRelation = {
  fromId: string
  toId: string
  kind: RelationKind
  source: RelationSource
  /** 왜 이었는지 한 줄. 사람이 검수할 때 이것만 읽고 판단한다 */
  reason: string
  /** 판정을 여러 번 뽑았을 때 찬성한 횟수 */
  votes: number
}

export type Relation = NewRelation & { id: string }

/**
 * 관계를 담는다.
 *
 * 같은 쌍·같은 종류는 한 줄로 유지한다. 판정을 여러 번 돌릴 것이고, 돌릴 때마다
 * 선이 늘면 지도가 같은 선을 겹쳐 그린다.
 *
 * 부딪히면 **표를 더 받은 쪽**을 남긴다. 나중 판정이 무조건 이기게 하면 회차마다
 * 흔들리는 결과를 그대로 받아쓰게 된다. 여러 번 돌리는 이유가 그 흔들림을
 * 걸러내는 것인데 마지막 회차만 남기면 돌린 의미가 없다.
 */
export async function saveRelations(rels: NewRelation[]): Promise<void> {
  const rows = rels.filter((r) => r.fromId !== r.toId)
  if (rows.length === 0) return

  const db = await getDb()
  await db.query(
    /*
     * enum 배열을 그대로 넘기지 않는다. 드라이버가 모르는 타입이라 배열을
     * `"a,b"` 한 덩이 문자열로 붙여 보내고 서버가 거부한다. text[]로 받아
     * 안에서 캐스팅하면 같은 값이 제대로 들어간다.
     */
    `insert into semantic_relation (from_id, to_id, kind, source, reason, votes)
     select f, t, k::relation_kind, s::relation_source, r, v
       from unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::int[])
         as u(f, t, k, s, r, v)
     on conflict (from_id, to_id, kind) do update
        set votes  = greatest(semantic_relation.votes, excluded.votes),
            reason = case when excluded.votes > semantic_relation.votes
                          then excluded.reason else semantic_relation.reason end,
            source = case when excluded.source = 'human' then 'human' else semantic_relation.source end`,
    [
      rows.map((r) => r.fromId),
      rows.map((r) => r.toId),
      rows.map((r) => r.kind),
      rows.map((r) => r.source),
      rows.map((r) => r.reason),
      rows.map((r) => r.votes),
    ],
  )
}

/**
 * 살아 있는 관계를 읽는다.
 *
 * `nodeIds`를 주면 **양쪽 끝이 다 그 안에 있는** 것만 준다. 화면에 없는 노드로
 * 뻗는 선은 허공으로 나가기 때문이다. `loadMapData`가 간선을 거르는 규칙과 같다.
 */
export async function loadRelations(opts: { nodeIds?: string[] } = {}): Promise<Relation[]> {
  const db = await getDb()

  if (opts.nodeIds) {
    // 빈 배열이면 선도 없다. any(빈 배열)은 아무것도 통과시키지 않지만, 질의를
    // 도는 것 자체가 낭비고 의도도 안 드러난다
    if (opts.nodeIds.length === 0) return []
    return db.query<Relation>(
      `select id, from_id as "fromId", to_id as "toId", kind, source, reason, votes
         from semantic_relation
        where active
          and from_id = any($1::uuid[])
          and to_id   = any($1::uuid[])
        order by votes desc, id asc`,
      [opts.nodeIds],
    )
  }

  return db.query<Relation>(
    `select id, from_id as "fromId", to_id as "toId", kind, source, reason, votes
       from semantic_relation
      where active
      order by votes desc, id asc`,
  )
}

/** 살아 있든 아니든 전부 센다. 판정이 얼마나 쌓였는지 볼 때 쓴다 */
export async function countRelations(): Promise<number> {
  const db = await getDb()
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from semantic_relation`)
  return row?.n ?? 0
}

/**
 * 선을 내린다. 지우지 않는다.
 *
 * 지우면 다음 판정이 같은 선을 다시 만든다. 왜 내렸는지가 남아야 재판정을 막는다.
 */
export async function deactivateRelation(id: string): Promise<void> {
  const db = await getDb()
  await db.query(`update semantic_relation set active = false where id = $1::uuid`, [id])
}
