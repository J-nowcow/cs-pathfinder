import { getDb } from '@/lib/db/client'

export type ClaimedSeed = { id: string; term: string; category: string }

/**
 * 미소비 시드 하나를 집어 소비 표시까지 한 문장으로 끝낸다.
 *
 * 선택과 소비가 갈리면 두 프로세스가 같은 시드를 집는다. update 한 문장이면
 * 암묵 트랜잭션 안이라 그 틈이 없다. `skip locked`는 남이 잡은 행을 건너뛴다.
 *
 * 카테고리 균형이 1차 정렬 기준이다. 시드를 무작위로 뽑으면 큰 카테고리가
 * 연달아 나와 게시판 탭이 한쪽만 찬다. 가장 오래 안 나온 카테고리를 먼저 쓴다.
 * 아직 한 번도 안 나온 카테고리는 -infinity라 항상 앞선다.
 *
 * 2차 기준은 남은 시드 수다. 첫 열흘처럼 모두가 -infinity로 묶일 때
 * 시드가 많은 카테고리를 먼저 꺼내 소진 속도를 맞춘다. 스펙 §4의 가중 배분이
 * 여기서 살아난다.
 */
export async function claimSeed(): Promise<ClaimedSeed | null> {
  const db = await getDb()

  const rows = await db.query<ClaimedSeed>(
    `update topic_seed
     set consumed_at = now()
     where id = (
       select s.id
       from topic_seed s
       where s.consumed_at is null
         and s.category = (
           select r.category
           from (
             select category, count(*) as remaining
             from topic_seed
             where consumed_at is null
             group by category
           ) r
           left join (
             select category, max(published_at) as last_at
             from tree
             where kind = 'daily'
             group by category
           ) p on p.category = r.category
           order by coalesce(p.last_at, '-infinity'::timestamptz) asc,
                    r.remaining desc,
                    r.category asc
           limit 1
         )
       order by s.id
       limit 1
       for update skip locked
     )
     returning id, term, category`,
  )

  return rows[0] ?? null
}

/**
 * 시드를 되돌린다.
 *
 * 생성이 실패했는데 소비 표시가 남으면 실패할 때마다 하루치가 조용히 녹는다.
 * 400개는 13개월치라 몇 번만 새도 눈에 띄지 않는다.
 */
export async function unclaimSeed(seedId: string): Promise<void> {
  const db = await getDb()
  await db.query('update topic_seed set consumed_at = null where id = $1', [seedId])
}

export async function countUnconsumedSeeds(): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ n: string }>(
    'select count(*) as n from topic_seed where consumed_at is null',
  )
  return Number(rows[0].n)
}
