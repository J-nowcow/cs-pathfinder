import { getDb } from '@/lib/db/client'

export type LeaseResult = 'acquired' | 'busy' | 'done'

export const DEFAULT_LEASE_SECONDS = 60

export async function acquireLease(
  hash: string,
  seconds: number = DEFAULT_LEASE_SECONDS,
): Promise<{ result: LeaseResult; qnodeId: string | null }> {
  const db = await getDb()
  const rows = await db.query<{ result: string; qnode_id: string | null }>(
    'select * from generation_acquire($1, $2)',
    [hash, seconds],
  )
  return {
    result: (rows[0]?.result ?? 'busy') as LeaseResult,
    qnodeId: rows[0]?.qnode_id ?? null,
  }
}

export async function completeLease(hash: string, qnodeId: string): Promise<void> {
  const db = await getDb()
  await db.query('select generation_complete($1, $2)', [hash, qnodeId])
}

export async function failLease(hash: string): Promise<void> {
  const db = await getDb()
  await db.query('select generation_fail($1)', [hash])
}
