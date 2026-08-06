import { getDb } from '@/lib/db/client'
import { kstToday } from '@/lib/daily/date'
import { isMissingTable } from '@/lib/db/missing-table'

/**
 * 전역 질문 지도에 실을 것.
 *
 * 제목과 카테고리만 내려보낸다. 해설은 노드를 눌렀을 때 따로 받는다 —
 * 질문 하나에 300~700자인데 전부 실어 나르면 지도를 열자마자 수십 KB를
 * 받게 되고, 그중 사람이 읽는 것은 눌러본 한둘뿐이다.
 */
export type MapNode = {
  id: string
  question: string
  category: string
}

export type MapEdge = {
  parentId: string
  childId: string
  /**
   * 이 선이 어디서 왔나.
   *
   * `walked`는 사람이 실제로 걸어간 길이고 `related`는 판정이 이은 관계다.
   * 화면이 둘을 다르게 그려야 한다 — 걸어간 길은 확실하고, 이어준 관계는
   * 판정 결과라 틀릴 수 있다. 같은 굵기로 그리면 그 차이가 사라진다.
   */
  kind: 'walked' | 'related'
  /** 왜 이었는지. `related`에만 있다 */
  reason?: string
}

export type MapData = {
  nodes: MapNode[]
  edges: MapEdge[]
}

/**
 * 지도에 실을 질문과 관계.
 *
 * 담는 기준은 `/questions` 목차와 같다. 사용자가 자유 입력으로 판 질문은 빼고,
 * 아직 오지 않은 발행분도 뺀다. 한 화면에서 보이는 것과 다른 화면에서 보이는
 * 것이 다르면 어느 쪽이 맞는지 알 수 없다.
 *
 * 순서는 `created_at`이다. 배치가 순서에서 나오므로 먼저 만들어진 질문이
 * 안쪽에 남고 새 질문이 바깥에 붙는다.
 */
export async function loadMapData(today: string = kstToday()): Promise<MapData> {
  const db = await getDb()

  const nodes = await db.query<MapNode>(
    `select n.id,
            n.normalized_question as question,
            n.primary_category    as category
       from qnode n
       left join tree t
              on t.root_node_id = n.id
             and t.kind = 'daily'
      where n.status = 'ready'
        and n.origin = 'batch'
        and (t.publish_date is null or t.publish_date <= $1::date)
      order by n.created_at asc, n.normalized_question asc`,
    [today],
  )

  if (nodes.length === 0) return { nodes: [], edges: [] }

  /*
   * 양쪽 끝이 다 목록에 있는 간선만 가져온다.
   *
   * 화면에 없는 노드로 이어진 선을 그리면 허공으로 뻗는다. 사용자가 판
   * 질문(on_demand)으로 이어진 간선이 대부분 여기 해당한다.
   */
  const ids = nodes.map((n) => n.id)

  /*
   * 걸어간 길과 이어준 관계를 함께 싣는다.
   *
   * 관계가 없으면 지도는 점만 249개다. 실제로 그랬다 — 꼬리질문이 기존 질문과
   * 같은 경우가 5%뿐이라 걸어간 길만으로는 선이 거의 안 생긴다.
   *
   * 표를 적게 받은 관계는 뺀다. 회차마다 흔들리는 것을 봤으므로 과반은
   * 최소 조건이고, 지도에 그릴 것은 그보다 확실해야 한다.
   */
  const [walked, related] = await Promise.all([
    db.query<MapEdge>(
      `select parent_id as "parentId", child_id as "childId", 'walked' as kind
         from qedge
        where parent_id = any($1::uuid[])
          and child_id  = any($1::uuid[])`,
      [ids],
    ),
    /*
     * 관계 표가 없어도 지도는 뜬다.
     *
     * 선은 덤이고 질문 목록이 본체다. 그런데 이 질의가 그대로 터지면서 지도만이
     * 아니라 홈과 목록까지 500이 됐다 — 마이그레이션 0009를 프로덕션에 적용하지
     * 않은 채 배포한 날 실제로 그랬다.
     *
     * 표가 없는 것은 배포 순서 문제이지 사용자가 알 일이 아니다. 선 없이 그리고
     * 로그에 무엇을 해야 하는지 남긴다.
     */
    db
      .query<MapEdge>(
        `select from_id as "parentId", to_id as "childId", 'related' as kind, reason
           from semantic_relation
          where active
            and votes >= 2
            and from_id = any($1::uuid[])
            and to_id   = any($1::uuid[])`,
        [ids],
      )
      .catch((e: unknown) => {
        if (!isMissingTable(e)) throw e
        console.warn('[map] semantic_relation이 없다. 선 없이 그린다 — npm run db:migrate')
        return [] as MapEdge[]
      }),
  ])

  /*
   * 같은 쌍이 양쪽에 있으면 걸어간 쪽을 남긴다. 사람이 실제로 지나간 것이
   * 판정보다 확실하다.
   */
  const seen = new Set(walked.map((e) => `${e.parentId}::${e.childId}`))
  const edges = [...walked, ...related.filter((e) => !seen.has(`${e.parentId}::${e.childId}`))]

  return { nodes, edges }
}
