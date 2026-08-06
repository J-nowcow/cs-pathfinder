import { getDb } from '@/lib/db/client'

export async function reserveQuota(key: string, limit: number): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query<{ quota_reserve: boolean }>(
    'select quota_reserve($1, $2) as quota_reserve',
    [key, limit],
  )
  return rows[0]?.quota_reserve === true
}

export async function commitQuota(key: string): Promise<void> {
  const db = await getDb()
  await db.query('select quota_commit($1)', [key])
}

export async function releaseQuota(key: string): Promise<void> {
  const db = await getDb()
  await db.query('select quota_release($1)', [key])
}

export async function getQuota(key: string): Promise<{ used: number; reserved: number }> {
  const db = await getDb()
  const rows = await db.query<{ used: number; reserved: number }>(
    'select * from quota_get($1)',
    [key],
  )
  return { used: Number(rows[0]?.used ?? 0), reserved: Number(rows[0]?.reserved ?? 0) }
}
