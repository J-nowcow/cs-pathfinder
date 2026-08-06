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
 * 실행: npm run check:graph
 */
const db = await getDb()
const nodes = await db.query<{ id: string }>(`select id from qnode where status = 'ready'`)
const edges = await db.query<Edge>(
  `select parent_id as "parentId", child_id as "childId" from qedge`,
)

const c = analyzeConnectivity(
  nodes.map((n) => n.id),
  edges,
)
const v = verdict(c)

console.log(`노드 ${c.nodes}개 · 간선 ${c.edges}개`)
console.log(`고립 ${c.isolated}개 (${Math.round(c.isolatedRatio * 100)}%)`)
console.log(`연결 요소 ${c.components.length}개 · 상위 ${c.components.slice(0, 6).join(', ')}`)
console.log(`가장 큰 덩어리 ${Math.round(c.largestRatio * 100)}% · 차수 중앙값 ${c.medianDegree}`)
console.log(`\n판단: ${v.ready ? '만들 만하다' : '아직 이르다'} — ${v.reason}`)
process.exit(0)
