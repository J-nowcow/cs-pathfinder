/** Read-only activation checks. Never migrates, seeds or reads answer/account rows. */
import type { Pool } from 'pg'
import { postgresPoolConfig } from '../../src/lib/db/postgres-config'
import { targetIdentity } from './library-migration'

type Environment = Record<string, string | undefined>
export function rolloutConfiguration(env: Environment) {
  if (env.LIBRARY_ACCOUNT_SYNC_ENABLED !== '1') return null
  const target = env.LIBRARY_ACCOUNT_EXPECTED_DB?.trim()
  if (!target || !/^[a-f0-9]{16}$/.test(target))
    throw Error('LIBRARY_EXPECTED_TARGET_REQUIRED')
  const raw = env.DATABASE_URL?.trim()
  if (!raw) throw Error('LIBRARY_DATABASE_REQUIRED')
  // Validates public-CA TCP configuration without making a connection.
  postgresPoolConfig(raw)
  if (targetIdentity(raw).fingerprint !== target)
    throw Error('LIBRARY_TARGET_MISMATCH')
  const expectedOrigin = env.LIBRARY_ACCOUNT_EXPECTED_ORIGIN?.trim()
  const authBase = env.BETTER_AUTH_URL?.trim()
  try {
    const origin = new URL(expectedOrigin ?? '')
    const auth = new URL(authBase ?? '')
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      auth.username ||
      auth.password ||
      auth.search ||
      auth.hash ||
      auth.pathname !== '/' ||
      auth.origin !== origin.origin
    )
      throw Error()
  } catch {
    throw Error('LIBRARY_AUTH_ORIGIN_MISMATCH')
  }
  if (
    !env.BETTER_AUTH_SECRET?.trim() ||
    !env.AUTH_GOOGLE_ID?.trim() ||
    !env.AUTH_GOOGLE_SECRET?.trim()
  )
    throw Error('LIBRARY_AUTH_CONFIGURATION_REQUIRED')
  // This object contains a private connection string. Never log or persist it.
  return { connectionString: raw, targetFingerprint: target }
}

export async function verifyRolloutSchema(pool: Pool) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN READ ONLY')
    await c.query(
      "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='10s'; SET LOCAL search_path=public,pg_catalog",
    )
    const tls = (
      c as unknown as {
        connection: {
          stream: { authorized?: boolean; getProtocol?: () => string }
        }
      }
    ).connection.stream
    if (tls.authorized !== true) throw Error('LIBRARY_TLS_REQUIRED')
    const mode = (
      await c.query("select current_setting('transaction_read_only') value")
    ).rows[0].value
    if (mode !== 'on') throw Error('LIBRARY_READ_ONLY_REQUIRED')
    const tables = (
      await c.query(`select c.relname,c.relrowsecurity,
      not exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee<>c.relowner) owner_only
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('library_study_snapshot','library_study_write') order by c.relname`)
    ).rows
    const columns = (
      await c.query(`select table_name,column_name,data_type,is_nullable from information_schema.columns
      where table_schema='public' and table_name in ('library_study_snapshot','library_study_write') order by table_name,ordinal_position`)
    ).rows
    const expected = [
      ['library_study_snapshot', 'user_id', 'text', 'NO'],
      ['library_study_snapshot', 'revision', 'integer', 'NO'],
      ['library_study_snapshot', 'state', 'jsonb', 'NO'],
      [
        'library_study_snapshot',
        'updated_at',
        'timestamp with time zone',
        'NO',
      ],
      ['library_study_write', 'user_id', 'text', 'NO'],
      ['library_study_write', 'request_id', 'uuid', 'NO'],
      ['library_study_write', 'payload_hash', 'text', 'NO'],
      ['library_study_write', 'revision', 'integer', 'NO'],
      ['library_study_write', 'created_at', 'timestamp with time zone', 'NO'],
    ]
    if (
      tables.length !== 2 ||
      tables.some((r) => !r.relrowsecurity || !r.owner_only) ||
      JSON.stringify(
        columns.map((r) => [
          r.table_name,
          r.column_name,
          r.data_type,
          r.is_nullable,
        ]),
      ) !== JSON.stringify(expected)
    )
      throw Error('LIBRARY_TABLE_SHAPE_MISMATCH')
    const constraints = (
      await c.query(`select c.relname,con.contype,con.confdeltype,ref.relname referenced,
      pg_get_constraintdef(con.oid) definition
      from pg_constraint con join pg_class c on c.oid=con.conrelid left join pg_class ref on ref.oid=con.confrelid
      where con.contype in ('p','f','c') and con.conrelid in ('public.library_study_snapshot'::regclass,'public.library_study_write'::regclass)`)
    ).rows
    const fks = constraints.filter((r) => r.contype === 'f')
    const pks = constraints.filter((r) => r.contype === 'p')
    const index = (
      await c.query(
        "select indexdef from pg_indexes where schemaname='public' and indexname='library_study_write_revision_idx'",
      )
    ).rows
    const log = (
      await c.query(
        "select count(*)::int n from public.schema_migrations where name='0022_library_study.sql'",
      )
    ).rows[0].n
    if (
      constraints.length !== 8 ||
      fks.length !== 2 ||
      fks.some((r) => r.confdeltype !== 'c') ||
      !fks.some(
        (r) =>
          r.relname === 'library_study_snapshot' && r.referenced === 'user',
      ) ||
      !fks.some(
        (r) =>
          r.relname === 'library_study_write' &&
          r.referenced === 'library_study_snapshot',
      ) ||
      !pks.some(
        (r) =>
          r.relname === 'library_study_snapshot' &&
          r.definition === 'PRIMARY KEY (user_id)',
      ) ||
      !pks.some(
        (r) =>
          r.relname === 'library_study_write' &&
          r.definition === 'PRIMARY KEY (user_id, request_id)',
      ) ||
      index.length !== 1 ||
      !index[0].indexdef.endsWith('(user_id, revision)') ||
      log !== 1
    )
      throw Error('LIBRARY_SCHEMA_READINESS_FAILED')
    return {
      readOnly: true,
      tlsAuthorized: true,
      tlsProtocol: tls.getProtocol?.(),
      tablesVerified: 2,
      columnsVerified: 9,
      migrationLogVerified: true,
    }
  } finally {
    await c.query('ROLLBACK').catch(() => undefined)
    c.release()
  }
}
