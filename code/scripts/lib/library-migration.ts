/** Restricted additive migration; never calls the general migration/seed runner. */
import { createHash } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
export const migrationName = '0022_library_study.sql'
export const reviewedSqlHash =
  '258287eac9ad6b44bcb9b3e5c6f57d4d057fa3422ab43e407eada943dc9d81bb'
export const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex')
export function targetIdentity(connectionString: string) {
  const u = new URL(connectionString)
  return {
    fingerprint: hash(u.hostname + u.pathname).slice(0, 16),
    binding: hash(
      JSON.stringify([u.hostname, u.port || '5432', u.pathname, u.username]),
    ),
  }
}
export type MigrationPlan = {
  version: 1
  createdAt: string
  target: ReturnType<typeof targetIdentity>
  migration: typeof migrationName
  sqlHash: string
  schemaHash: string
  backupHash: string
}
export async function inspect(client: PoolClient) {
  const flags = (
    await client.query(`select
    to_regclass('public."user"') is not null auth_present,
    to_regclass('public.schema_migrations') is not null log_present,
    to_regclass('public.library_study_snapshot') is not null snapshot_present,
    to_regclass('public.library_study_write') is not null receipts_present,
    has_schema_privilege(current_user, 'public', 'CREATE') can_create`)
  ).rows[0]
  if (
    !flags.auth_present ||
    !flags.log_present ||
    !flags.can_create ||
    flags.snapshot_present ||
    flags.receipts_present
  )
    throw Error('PREFLIGHT_REFUSED')
  const columns = (
    await client.query(`select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_schema='public' and table_name in ('user','schema_migrations') order by table_name, ordinal_position`)
  ).rows
  const id = columns.find(
    (r) => r.table_name === 'user' && r.column_name === 'id',
  )
  const name = columns.find(
    (r) => r.table_name === 'schema_migrations' && r.column_name === 'name',
  )
  if (
    id?.data_type !== 'text' ||
    id.is_nullable !== 'NO' ||
    name?.data_type !== 'text'
  )
    throw Error('AUTH_OR_LOG_SHAPE_REFUSED')
  const constraints = (
    await client.query(`select c.relname, con.conname, pg_get_constraintdef(con.oid) definition
    from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('user','schema_migrations') order by c.relname,con.conname`)
  ).rows
  if (
    !constraints.some(
      (r) => r.relname === 'user' && r.definition === 'PRIMARY KEY (id)',
    ) ||
    !constraints.some(
      (r) =>
        r.relname === 'schema_migrations' &&
        r.definition === 'PRIMARY KEY (name)',
    )
  )
    throw Error('PRIMARY_KEY_REFUSED')
  const applied = (
    await client.query(
      'select exists(select 1 from public.schema_migrations where name=$1) applied',
      [migrationName],
    )
  ).rows[0].applied
  if (applied) throw Error('ALREADY_APPLIED')
  return { flags, schemaHash: hash(JSON.stringify({ columns, constraints })) }
}
export async function preflight(pool: Pool) {
  const c = await pool.connect()
  try {
    await c.query('begin read only')
    await c.query("set local statement_timeout='15s'")
    const value = await inspect(c)
    const readOnly = (
      await c.query("select current_setting('transaction_read_only') value")
    ).rows[0].value
    if (readOnly !== 'on') throw Error('READ_ONLY_REQUIRED')
    return value
  } finally {
    await c.query('rollback').catch(() => undefined)
    c.release()
  }
}
export function validatePlan(
  plan: MigrationPlan,
  connectionString: string,
  sql: string,
  backup: Buffer,
  now = Date.now(),
) {
  const target = targetIdentity(connectionString)
  const age = now - Date.parse(plan.createdAt)
  if (
    plan.version !== 1 ||
    plan.migration !== migrationName ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 24 * 3600_000 ||
    plan.target?.fingerprint !== target.fingerprint ||
    plan.target?.binding !== target.binding ||
    plan.sqlHash !== reviewedSqlHash ||
    plan.sqlHash !== hash(sql) ||
    plan.backupHash !== hash(backup) ||
    !/^[a-f0-9]{64}$/.test(plan.schemaHash)
  )
    throw Error('PLAN_REFUSED')
}
export async function applyOnlyLibrary(
  pool: Pool,
  plan: MigrationPlan,
  connectionString: string,
  sql: string,
  backup: Buffer,
) {
  validatePlan(plan, connectionString, sql, backup)
  const c = await pool.connect()
  try {
    await c.query('begin')
    await c.query(
      "set local lock_timeout='3s'; set local statement_timeout='15s'; set local search_path=public,pg_catalog",
    )
    // Serializes this tool, not unrelated DDL; rechecks and transaction errors fail closed.
    await c.query('select pg_advisory_xact_lock(20261028,22)')
    const before = await inspect(c)
    if (before.schemaHash !== plan.schemaHash) throw Error('SCHEMA_CHANGED')
    await c.query(sql)
    await c.query('insert into public.schema_migrations(name) values($1)', [
      migrationName,
    ])
    const tables = (
      await c.query(`select c.relname, c.relrowsecurity,
      not exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee<>c.relowner) owner_only
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('library_study_snapshot','library_study_write') order by c.relname`)
    ).rows
    const constraints = (
      await c.query(
        `select pg_get_constraintdef(oid) definition from pg_constraint where contype in ('p','f','c') and conrelid in ('public.library_study_snapshot'::regclass,'public.library_study_write'::regclass) order by conname`,
      )
    ).rows
    const columns = (
      await c.query(
        `select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('library_study_snapshot','library_study_write') order by table_name,ordinal_position`,
      )
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
    const index = (
      await c.query(
        "select indexdef from pg_indexes where schemaname='public' and indexname='library_study_write_revision_idx'",
      )
    ).rows
    if (
      tables.length !== 2 ||
      JSON.stringify(
        columns.map((r) => [
          r.table_name,
          r.column_name,
          r.data_type,
          r.is_nullable,
        ]),
      ) !== JSON.stringify(expected) ||
      constraints.length !== 8 ||
      index.length !== 1 ||
      !index[0].indexdef.endsWith('(user_id, revision)') ||
      tables.some((r) => !r.relrowsecurity || !r.owner_only) ||
      constraints.filter((r) => r.definition.includes('ON DELETE CASCADE'))
        .length !== 2
    )
      throw Error('POSTCHECK_REFUSED')
    await c.query('commit')
    return {
      applied: migrationName,
      schemaChecksPassed: true,
      rolloutEnabled: false,
      testRowsWritten: false,
    }
  } catch (error) {
    await c.query('rollback').catch(() => undefined)
    throw error
  } finally {
    c.release()
  }
}
