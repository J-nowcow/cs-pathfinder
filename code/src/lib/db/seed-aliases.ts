import type { Tx } from '@/lib/db/client'

export type SeedAlias = { hash: string; nodeId: string }
const BATCH_SIZE = 256

/** Preserve first-seed precedence and existing mappings, with bounded insert batches. */
export async function insertSeedAliases(
  db: Tx,
  version: string,
  aliases: readonly SeedAlias[],
): Promise<void> {
  const first = new Map<string, SeedAlias>()
  for (const alias of aliases)
    if (!first.has(alias.hash)) first.set(alias.hash, alias)
  const rows = [...first.values()]
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)
    await db.query(
      `insert into qnode_alias (normalizer_version, normalized_hash, qnode_id)
       select $1, a.hash, a.node_id
         from unnest($2::text[], $3::uuid[]) as a(hash, node_id)
       on conflict (normalizer_version, normalized_hash) do nothing`,
      [version, batch.map((row) => row.hash), batch.map((row) => row.nodeId)],
    )
  }
}
