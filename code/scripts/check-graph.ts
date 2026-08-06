import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { analyzeConnectivity, verdict, type Edge } from '../src/lib/graph/connectivity'

/**
 * 지도를 만들 만한지 실제 데이터로 확인한다.
 *
 * Codex 검토에서 "구현 전에 qedge의 고립 노드 수와 연결 요소를 먼저 보라"고
 * 나왔다. 선이 거의 없으면 화면은 지식망이 아니라 흩어진 카드가 되고, 그
 * 사실을 좌표 저장·LOD·바텀시트를 다 만든 뒤에 알면 늦다.
 *
 * **두 종류를 다 센다.** 원래 `qedge`만 봤는데, 지도가 그리는 선은 두
 * 종류다 — 누군가 실제로 걸어간 길(`qedge`, 진한 선)과 뜻이 비슷해서 이어준
 * 관계(`semantic_relation`, 옅은 점선)다. 절반만 세면 화면에 그려진 것보다
 * 훨씬 성긴 그래프를 보고 판단하게 된다. 고립 비율이 특히 크게 어긋난다.
 *
 * 나눠서도 세고 합쳐서도 센다. 걸어간 길만으로 얼마나 이어지는지는 그것대로
 * 알아야 한다 — 그쪽이 사람이 만든 신호다.
 *
 * 실행: npm run check:graph
 */
const db = await getDb()
const nodes = await db.query<{ id: string }>(`select id from qnode where status = 'ready'`)
const ids = nodes.map((n) => n.id)

const walked = await db.query<Edge>(
  `select parent_id as "parentId", child_id as "childId" from qedge`,
)
/* 화면에 그려지는 것만 센다. 꺼진 관계는 선이 안 나간다 */
const semantic = await db.query<Edge>(
  `select from_id as "parentId", to_id as "childId" from semantic_relation where active`,
)

function report(label: string, edges: Edge[]) {
  const c = analyzeConnectivity(ids, edges)
  console.log(`\n## ${label}`)
  console.log(`노드 ${c.nodes}개 · 간선 ${c.edges}개`)
  console.log(`고립 ${c.isolated}개 (${Math.round(c.isolatedRatio * 100)}%)`)
  console.log(`연결 요소 ${c.components.length}개 · 상위 ${c.components.slice(0, 6).join(', ')}`)
  console.log(`가장 큰 덩어리 ${Math.round(c.largestRatio * 100)}% · 차수 중앙값 ${c.medianDegree}`)
  return c
}

report('걸어간 길만 (qedge · 진한 선)', walked)
report('이어준 관계만 (semantic_relation · 옅은 점선)', semantic)
const both = report('화면에 실제로 그려지는 것 (둘 다)', [...walked, ...semantic])

const v = verdict(both)
console.log(`\n판단: ${v.ready ? '만들 만하다' : '아직 이르다'} — ${v.reason}`)
process.exit(0)
