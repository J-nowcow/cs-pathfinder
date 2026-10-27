import { createHash } from 'node:crypto'
import { getDb, type Db, type Tx } from './client'
import { emptyLibrary } from '@/lib/library/storage'
import {
  canonicalLibraryJson,
  libraryAccountStateSchema,
  libraryWriteSchema,
  MAX_LIBRARY_BYTES,
  type LibrarySnapshot,
  type LibraryWrite,
} from '@/lib/library/account-schema'

type Row = { revision: number; state: unknown }
function snapshot(row?: Row): LibrarySnapshot {
  if (!row) return { revision: 0, state: emptyLibrary() }
  return {
    revision: row.revision,
    state: libraryAccountStateSchema.parse(row.state),
  }
}
export async function loadLibraryForUser(
  userId: string,
  db?: Tx,
): Promise<LibrarySnapshot> {
  const connection = db ?? (await getDb())
  const rows = await connection.query<Row>(
    'select revision, state from library_study_snapshot where user_id = $1',
    [userId],
  )
  return snapshot(rows[0])
}
export type LibraryWriteResult =
  | {
      kind: 'ok'
      snapshot: LibrarySnapshot
      acknowledgedRevision: number
      replayed: boolean
    }
  | { kind: 'conflict'; snapshot: LibrarySnapshot }
  | { kind: 'request_id_reused' }

export async function writeLibraryForUser(
  userId: string,
  input: LibraryWrite,
  db?: Db,
): Promise<LibraryWriteResult> {
  const data = libraryWriteSchema.parse(input)
  const serialized = canonicalLibraryJson(data.state)
  if (Buffer.byteLength(serialized) > MAX_LIBRARY_BYTES)
    throw new Error('library_state_too_large')
  const hash = createHash('sha256')
    .update(canonicalLibraryJson(data))
    .digest('hex')
  const connection = db ?? (await getDb())
  return connection.transaction(async (tx) => {
    await tx.query("set local lock_timeout = '3s'")
    await tx.query("set local statement_timeout = '10s'")
    // Serialize writes on one owner row, including first-write races.
    await tx.query(
      'insert into library_study_snapshot (user_id) values ($1) on conflict (user_id) do nothing',
      [userId],
    )
    const [row] = await tx.query<Row>(
      'select revision, state from library_study_snapshot where user_id = $1 for update',
      [userId],
    )
    if (!row) throw new Error('library_owner_missing')
    const current = snapshot(row)
    const [receipt] = await tx.query<{
      payload_hash: string
      revision: number
    }>(
      'select payload_hash, revision from library_study_write where user_id = $1 and request_id = $2',
      [userId, data.requestId],
    )
    if (receipt) {
      if (receipt.payload_hash !== hash) return { kind: 'request_id_reused' }
      return {
        kind: 'ok',
        snapshot: current,
        acknowledgedRevision: receipt.revision,
        replayed: true,
      }
    }
    if (current.revision !== data.baseRevision)
      return { kind: 'conflict', snapshot: current }
    const [saved] = await tx.query<Row>(
      'update library_study_snapshot set revision = revision + 1, state = $3::jsonb, updated_at = now() where user_id = $1 and revision = $2 returning revision, state',
      [userId, data.baseRevision, serialized],
    )
    if (!saved) throw new Error('library_revision_changed')
    await tx.query(
      'insert into library_study_write (user_id, request_id, payload_hash, revision) values ($1, $2, $3, $4)',
      [userId, data.requestId, hash, saved.revision],
    )
    // Recent retries are idempotent. Older retries still fail the revision check.
    await tx.query(
      'delete from library_study_write where user_id = $1 and revision <= $2',
      [userId, saved.revision - 64],
    )
    return {
      kind: 'ok',
      snapshot: snapshot(saved),
      acknowledgedRevision: saved.revision,
      replayed: false,
    }
  })
}
