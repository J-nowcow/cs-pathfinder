import { getDb } from '@/lib/db/client'
import { embedQuestions } from '@/lib/embed/gemini'

/**
 * 임베딩이 빈 노드를 채운다.
 *
 * 두 자리에서 부른다.
 * - **응답 뒤 백필** — 확장이 새 노드를 만들면 라우트가 `after()`로 그
 *   노드 하나를 채운다. 사용자는 기다리지 않는다
 * - **매일 스윕** — GitHub Actions가 `/api/embed-sweep`을 불러 놓친 것을
 *   줍는다. 백필이 실패한 노드·일일 발행이 만든 노드가 여기서 잡힌다
 *
 * 스윕이 있어야 백필이 fail-open일 수 있다. 스윕이 없으면 백필 실패가
 * "영영 안 채워짐"이 된다 — launchd 데일리 아카이브가 한 달간 조용히
 * 실패했던 그 모양이다. 놓친 것을 줍는 그물이 따로 있어야 앞단이 가볍다.
 */

export type EmbedFn = (texts: string[]) => Promise<number[][]>

/**
 * 노드 하나를 채운다. **절대 던지지 않는다.**
 *
 * `after()` 안에서 돌므로 여기서 던져 봐야 받는 사람이 없고, 노드 생성은
 * 이미 성공한 뒤다. 실패하면 NULL로 남고 다음 스윕이 줍는다.
 */
export async function backfillEmbedding(nodeId: string, embed: EmbedFn = embedQuestions): Promise<void> {
  try {
    const db = await getDb()
    const rows = await db.query<{ q: string }>(
      `select normalized_question as q from qnode
        where id = $1 and embedding is null`,
      [nodeId],
    )
    if (rows.length === 0) return

    const [vec] = await embed([rows[0].q])
    /* 그 사이 스윕이 채웠으면 덮지 않는다 */
    await db.query(`update qnode set embedding = $2::real[] where id = $1 and embedding is null`, [
      nodeId,
      vec,
    ])
  } catch (e) {
    console.warn('[embed] 백필 실패. 다음 스윕이 줍는다 —', String(e).slice(0, 200))
  }
}

export type SweepResult = { scanned: number; filled: number; failed: number }

/**
 * 빈 것을 모아 채운다. 스윕 라우트가 부른다.
 *
 * 한 번에 다 하지 않는다. 서버리스 함수 예산(60초) 안에서 끝나야 하고,
 * 남으면 다음 날 스윕이 이어서 한다. 하루에 새로 생기는 노드가 손에 꼽는
 * 수준이라 상한에 걸리는 날은 밀린 것을 따라잡는 날뿐이다.
 */
export async function sweepEmbeddings(limit = 200, embed: EmbedFn = embedQuestions): Promise<SweepResult> {
  const db = await getDb()
  const rows = await db.query<{ id: string; q: string }>(
    `select id, normalized_question as q from qnode
      where status = 'ready' and embedding is null
      order by created_at asc
      limit $1`,
    [limit],
  )
  if (rows.length === 0) return { scanned: 0, filled: 0, failed: 0 }

  let filled = 0
  let failed = 0
  const SIZE = 50
  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE)
    try {
      const vecs = await embed(chunk.map((c) => c.q))
      for (const [j, node] of chunk.entries()) {
        await db.query(
          `update qnode set embedding = $2::real[] where id = $1 and embedding is null`,
          [node.id, vecs[j]],
        )
        filled += 1
      }
    } catch (e) {
      /* 한 덩이가 죽어도 다음 덩이는 시도한다. 남은 것은 내일 스윕 몫이다 */
      failed += chunk.length
      console.warn('[embed] 스윕 덩이 실패 —', String(e).slice(0, 200))
    }
  }
  return { scanned: rows.length, filled, failed }
}
