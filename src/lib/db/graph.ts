import { getDb } from '@/lib/db/client'
import { kstToday } from '@/lib/daily/date'

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
  const edges = await db.query<MapEdge>(
    `select parent_id as "parentId", child_id as "childId"
       from qedge
      where parent_id = any($1::uuid[])
        and child_id  = any($1::uuid[])`,
    [ids],
  )

  return { nodes, edges }
}
