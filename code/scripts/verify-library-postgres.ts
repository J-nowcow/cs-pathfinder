/** Opt-in real-Postgres verification. Creates and destroys only its own cluster. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import {
  loadLibraryForUser,
  writeLibraryForUser,
} from '../src/lib/db/library-study'
import type { Db, Tx } from '../src/lib/db/client'
import type { LibraryState } from '../src/lib/library/storage'
import {
  applyOnlyLibrary,
  hash,
  preflight,
  targetIdentity,
  type MigrationPlan,
} from './lib/library-migration'
import { verifyRolloutSchema } from './lib/library-rollout'
import { schemaBackup } from './lib/library-schema-backup'
import { checkRelationWriteCost } from './lib/relation-write-check'

// Never read DATABASE_URL, PG* connection environment or private app env files.
const args = process.argv.slice(2)
if (
  args.length !== 6 ||
  args.filter((v) => ['--bin-dir', '--work-dir', '--report'].includes(v))
    .length !== 3
)
  throw Error(
    'Use only --bin-dir, --work-dir and --report with absolute paths.',
  )
function argument(name: string) {
  const at = args.indexOf(name),
    value = args[at + 1]
  if (at < 0 || !value || !isAbsolute(value))
    throw Error('Required absolute argument: ' + name)
  return value
}
const bin = argument('--bin-dir'),
  work = argument('--work-dir'),
  reportPath = argument('--report')
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(work, { recursive: true, mode: 0o700 })
const run = mkdtempSync(join(realpathSync(work), 'library-pg-'))
chmodSync(run, 0o700)
const data = join(run, 'cluster'),
  tlsDir = join(run, 'tls')
mkdirSync(tlsDir, { mode: 0o700 })
const password = randomBytes(32).toString('hex')
const passwordFile = join(run, 'password')
writeFileSync(passwordFile, password + '\n', { mode: 0o600 })
const pools: Pool[] = [],
  backends = new Set<number>()
const checks: Array<{ name: string; passed: boolean; milliseconds: number }> =
  []
let attemptedStart = false,
  stage = 'setup',
  port = 0
const result: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  implementation: 'real PostgreSQL, dedicated local cluster',
  productionAccess: false,
  applicationEnvironmentRead: false,
  checks,
}
const runBinary = (name: string, argv: string[]) =>
  execFileSync(join(bin, name), argv, { stdio: 'ignore', timeout: 20000 })
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
async function check(name: string, fn: () => Promise<void>) {
  stage = name
  const before = performance.now()
  await fn()
  checks.push({
    name,
    passed: true,
    milliseconds: Math.round(performance.now() - before),
  })
  console.log('PASS ' + name)
}
async function reservePort() {
  const server = createServer()
  await new Promise<void>((r, j) => {
    server.once('error', j)
    server.listen(0, '127.0.0.1', r)
  })
  const assigned = (server.address() as { port: number }).port
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())))
  return assigned
}
function pool(user: string, database: string, extra: Partial<PoolConfig> = {}) {
  const connection = new Pool({
    host: '127.0.0.1',
    port,
    database,
    user,
    password,
    ssl: {
      ca: readFileSync(join(tlsDir, 'ca.pem'), 'utf8'),
      servername: 'localhost',
      rejectUnauthorized: true,
    },
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    application_name: 'pathfinder-library-verification',
    options: '-c statement_timeout=12000',
    ...extra,
  })
  pools.push(connection)
  return connection
}
function db(connection: Pool, label = 'writer'): Db {
  const tx = (client: PoolClient): Tx => ({
    query: async <T>(sql: string, params?: unknown[]) =>
      (await client.query(sql, params)).rows as T[],
  })
  return {
    query: async <T>(sql: string, params?: unknown[]) =>
      (await connection.query(sql, params)).rows as T[],
    exec: async (sql) => {
      await connection.query(sql)
    },
    transaction: async <T>(fn: (t: Tx) => Promise<T>) => {
      const client = await connection.connect()
      try {
        await client.query('begin')
        const [{ pid }] = (await client.query('select pg_backend_pid() pid'))
          .rows
        backends.add(pid)
        await client.query("select set_config('application_name', $1, true)", [
          'pathfinder-libcheck:' + label,
        ])
        const value = await fn(tx(client))
        await client.query('commit')
        return value
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
  }
}
function state(text: string): LibraryState {
  return {
    version: 1,
    entries: {
      'topic:normalization': {
        title: 'Normal forms',
        href: '/learn/engineer/normalization',
        track: 'engineer',
        draft: text,
        checks: ['Dependency identified'],
        status: 'review',
        due: '2026-10-29',
        updatedAt: '2026-10-28T00:00:00Z',
        visitedAt: '2026-10-28T00:00:00Z',
      },
    },
  }
}
const write = (
  baseRevision: number,
  text: string,
  requestId = randomUUID(),
) => ({ baseRevision, state: state(text), requestId })
async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === code,
    ),
  )
}
async function bounded<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_r, reject) => {
        timer = setTimeout(() => reject(Error('bounded_wait')), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer!)
  }
}
try {
  const openssl = (...argv: string[]) =>
    execFileSync('openssl', argv, {
      cwd: tlsDir,
      stdio: 'ignore',
      timeout: 20000,
    })
  openssl(
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    'ca.key',
    '-out',
    'ca.pem',
    '-days',
    '1',
    '-subj',
    '/CN=Pathfinder Disposable Test CA',
  )
  openssl(
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    'server.key',
    '-out',
    'server.csr',
    '-subj',
    '/CN=localhost',
  )
  writeFileSync(
    join(tlsDir, 'server.ext'),
    'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n',
  )
  openssl(
    'x509',
    '-req',
    '-in',
    'server.csr',
    '-CA',
    'ca.pem',
    '-CAkey',
    'ca.key',
    '-CAcreateserial',
    '-out',
    'server.pem',
    '-days',
    '1',
    '-extfile',
    'server.ext',
  )
  for (const name of ['ca.key', 'server.key'])
    chmodSync(join(tlsDir, name), 0o600)
  runBinary('initdb', [
    '-D',
    data,
    '-U',
    'library_check_admin',
    '--pwfile',
    passwordFile,
    '--auth-local=scram-sha-256',
    '--auth-host=scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ])
  port = await reservePort()
  writeFileSync(
    join(data, 'pg_hba.conf'),
    'local all all reject\nhostnossl all all 0.0.0.0/0 reject\nhostnossl all all ::0/0 reject\nhostssl all all 127.0.0.1/32 scram-sha-256\n',
    { mode: 0o600 },
  )
  const quote = (v: string) => "'" + v.replaceAll("'", "''") + "'"
  writeFileSync(
    join(data, 'postgresql.auto.conf'),
    [
      "listen_addresses = '127.0.0.1'",
      `port = ${port}`,
      "unix_socket_directories = ''",
      'max_connections = 24',
      "shared_buffers = '32MB'",
      'ssl = on',
      `ssl_cert_file = ${quote(join(tlsDir, 'server.pem'))}`,
      `ssl_key_file = ${quote(join(tlsDir, 'server.key'))}`,
      "ssl_min_protocol_version = 'TLSv1.2'",
      "password_encryption = 'scram-sha-256'",
      "log_statement = 'none'",
      "log_min_error_statement = 'panic'",
      'log_parameter_max_length_on_error = 0',
    ].join('\n') + '\n',
  )
  attemptedStart = true
  runBinary('pg_ctl', [
    'start',
    '-D',
    data,
    '-l',
    join(run, 'server.log'),
    '-w',
    '-t',
    '10',
  ])
  const admin = pool('library_check_admin', 'postgres', { max: 2 })
  const target = (
    await admin.query(
      "select current_setting('data_directory') path, inet_server_addr() host, inet_server_port() port, version() version",
    )
  ).rows[0]
  assert.equal(realpathSync(target.path), realpathSync(data))
  assert.equal(target.host, '127.0.0.1')
  assert.equal(target.port, port)
  result.serverVersion = target.version
  result.loopbackOnly = true
  result.dedicatedClusterVerified = true
  // Generated hex passwords never go into CLI arguments, output, reports or app env.
  await admin.query(
    `create role library_check_app login nosuperuser nobypassrls password '${password}'`,
  )
  await admin.query(
    `create role library_check_reader login nosuperuser nobypassrls password '${password}'`,
  )
  await admin.query(
    'create database cs_pathfinder_library_check owner library_check_app',
  )
  const application = pool('library_check_app', 'cs_pathfinder_library_check'),
    app = db(application)
  const migration = readFileSync(
    join(source, 'supabase/migrations/0022_library_study.sql'),
    'utf8',
  )
  const rollback = readFileSync(
    join(source, 'docs/operations/library-account-empty-rollback.sql'),
    'utf8',
  )
  await check('verified TLS and SCRAM-only isolated connection', async () => {
    const client = await application.connect()
    try {
      const stream = (
        client as unknown as {
          connection: { stream: { authorized: boolean; getProtocol(): string } }
        }
      ).connection.stream
      assert.equal(stream.authorized, true)
      const row = (
        await client.query(
          'select ssl, version from pg_stat_ssl where pid=pg_backend_pid()',
        )
      ).rows[0]
      assert.equal(row.ssl, true)
      result.tls = {
        authorized: true,
        protocol: stream.getProtocol(),
        serverProtocol: row.version,
        perProcessTestCA: true,
        systemTrustChanged: false,
      }
      assert.equal(
        (
          await client.query(
            'select rolsuper, rolbypassrls from pg_roles where rolname=current_user',
          )
        ).rows[0].rolsuper,
        false,
      )
      assert.equal(
        (
          await client.query(
            'select rolsuper, rolbypassrls from pg_roles where rolname=current_user',
          )
        ).rows[0].rolbypassrls,
        false,
      )
    } finally {
      client.release()
    }
    const hba = (
      await admin.query(
        'select type, auth_method from pg_hba_file_rules where error is null',
      )
    ).rows
    assert(
      hba.some(
        (r) => r.type === 'hostssl' && r.auth_method === 'scram-sha-256',
      ),
    )
    assert(
      hba.every(
        (r) => r.auth_method === 'scram-sha-256' || r.auth_method === 'reject',
      ),
    )
  })
  await check(
    'relation UPSERT avoids unchanged row versions and preserves concurrent votes/provenance',
    async () => {
      await admin.query(
        'create database cs_pathfinder_relation_check owner library_check_app',
      )
      result.relationWriteCost = await checkRelationWriteCost(
        pool('library_check_app', 'cs_pathfinder_relation_check'),
        join(source, 'supabase/migrations/0009_semantic_relation.sql'),
      )
    },
  )
  await check('untrusted CA and wrong hostname are rejected', async () => {
    const untrusted = pool('library_check_app', 'cs_pathfinder_library_check', {
      ssl: { rejectUnauthorized: true, servername: 'localhost' },
    })
    await assert.rejects(untrusted.query('select 1'))
    const wrong = pool('library_check_app', 'cs_pathfinder_library_check', {
      ssl: {
        ca: readFileSync(join(tlsDir, 'ca.pem'), 'utf8'),
        rejectUnauthorized: true,
        servername: 'wrong.invalid',
      },
    })
    await assert.rejects(wrong.query('select 1'), (e: unknown) =>
      Boolean(
        e &&
          typeof e === 'object' &&
          'code' in e &&
          e.code === 'ERR_TLS_CERT_ALTNAME_INVALID',
      ),
    )
  })
  await check('wrong password is rejected over verified TLS', async () => {
    const wrong = pool('library_check_app', 'cs_pathfinder_library_check', {
      password: 'deliberately-invalid-verification-password',
    })
    await expectCode(wrong.query('select 1'), '28P01')
  })
  await check(
    'guarded migration rejects target/file/schema drift and rolls back failed log writes',
    async () => {
      await admin.query(
        'create database library_migration_check owner library_check_app',
      )
      const candidate = pool('library_check_app', 'library_migration_check')
      await candidate.query(
        'create table "user"(id text primary key); create table schema_migrations(name text primary key, applied_at timestamptz not null default now())',
      )
      await candidate.query('insert into "user" values($1)', [
        'PRIVATE_SYNTHETIC_ROW_MUST_NOT_BE_BACKED_UP',
      ])
      const connection = `postgres://library_check_app:${password}@127.0.0.1:${port}/library_migration_check`
      stage = 'migration preflight'
      const before = await preflight(candidate)
      const directory = join(run, 'schema-backup')
      mkdirSync(directory, { mode: 0o700 })
      stage = 'migration schema-only backup'
      const backupInfo = schemaBackup(
        bin,
        directory,
        connection,
        readFileSync(join(tlsDir, 'ca.pem'), 'utf8'),
      )
      const backup = readFileSync(join(directory, 'schema.dump'))
      assert.equal(statSync(join(directory, 'schema.dump')).mode & 0o777, 0o600)
      stage = 'migration plan validation'
      const plan: MigrationPlan = {
        version: 1,
        createdAt: new Date().toISOString(),
        target: targetIdentity(connection),
        migration: '0022_library_study.sql',
        sqlHash: hash(migration),
        schemaHash: before.schemaHash,
        backupHash: backupInfo.backupHash,
      }
      for (const [p, url, sql, bytes] of [
        [plan, connection + '-wrong', migration, backup],
        [plan, connection, migration + '--tampered', backup],
        [plan, connection, migration, Buffer.from('tampered')],
        [
          { ...plan, createdAt: '2000-01-01T00:00:00Z' },
          connection,
          migration,
          backup,
        ],
      ] as const)
        await assert.rejects(
          applyOnlyLibrary(candidate, p, url, sql, bytes),
          /PLAN_REFUSED/,
        )
      stage = 'migration schema drift'
      await candidate.query('alter table "user" add column drift text')
      await assert.rejects(
        applyOnlyLibrary(candidate, plan, connection, migration, backup),
        /SCHEMA_CHANGED/,
      )
      await candidate.query('alter table "user" drop column drift')
      // Dropped catalog columns are not visible; the relevant public schema is back to its original shape.
      assert.equal((await preflight(candidate)).schemaHash, plan.schemaHash)
      await candidate.query(
        `create function fail_migration_log() returns trigger language plpgsql as $$begin raise exception 'synthetic failure'; end$$; create trigger fail_log before insert on schema_migrations for each row execute function fail_migration_log()`,
      )
      stage = 'migration log fault'
      await expectCode(
        applyOnlyLibrary(candidate, plan, connection, migration, backup),
        'P0001',
      )
      assert.equal((await preflight(candidate)).schemaHash, plan.schemaHash)
      await candidate.query(
        'drop trigger fail_log on schema_migrations; drop function fail_migration_log()',
      )
      stage = 'migration concurrent apply'
      const outcomes = await Promise.allSettled(
        Array.from({ length: 2 }, () =>
          applyOnlyLibrary(candidate, plan, connection, migration, backup),
        ),
      )
      assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1)
      assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1)
      assert.equal(
        (await candidate.query('select count(*)::int n from schema_migrations'))
          .rows[0].n,
        1,
      )
      assert.equal(
        (
          await candidate.query(
            'select count(*)::int n from library_study_snapshot',
          )
        ).rows[0].n,
        0,
      )
      await check(
        'read-only rollout gate rejects missing grants/RLS/index/log readiness without writing rows',
        async () => {
          const ready = await verifyRolloutSchema(candidate)
          assert.equal(ready.readOnly, true)
          assert.equal(ready.tlsAuthorized, true)
          await candidate.query(
            'grant select on library_study_snapshot to public',
          )
          await assert.rejects(verifyRolloutSchema(candidate))
          await candidate.query(
            'revoke all on library_study_snapshot from public',
          )
          await candidate.query(
            'alter table library_study_snapshot disable row level security',
          )
          await assert.rejects(verifyRolloutSchema(candidate))
          await candidate.query(
            'alter table library_study_snapshot enable row level security',
          )
          await candidate.query('drop index library_study_write_revision_idx')
          await assert.rejects(verifyRolloutSchema(candidate))
          await candidate.query(
            'create index library_study_write_revision_idx on library_study_write(user_id,revision)',
          )
          await candidate.query(
            "delete from schema_migrations where name='0022_library_study.sql'",
          )
          await assert.rejects(verifyRolloutSchema(candidate))
          await candidate.query(
            "insert into schema_migrations(name) values('0022_library_study.sql')",
          )
          assert.equal(
            (await verifyRolloutSchema(candidate)).migrationLogVerified,
            true,
          )
          assert.equal(
            (
              await candidate.query(
                'select count(*)::int n from library_study_snapshot',
              )
            ).rows[0].n,
            0,
          )
          assert.equal(
            (
              await candidate.query(
                'select count(*)::int n from library_study_write',
              )
            ).rows[0].n,
            0,
          )
          result.rolloutReadiness = {
            passed: true,
            negativeCases: 4,
            newRowsWrittenByGate: 0,
            productionAccess: false,
          }
        },
      )
      stage = 'migration rollback'
      await candidate.query(rollback)
      await preflight(candidate)
      // Restore this schema-only archive only into a second owned disposable database.
      stage = 'migration archive restore'
      await admin.query(
        'create database library_restore_check owner library_check_app',
      )
      execFileSync(
        join(bin, 'pg_restore'),
        [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '--exit-on-error',
          '--dbname',
          'library_restore_check',
          join(directory, 'schema.dump'),
        ],
        {
          env: {
            NODE_ENV: process.env.NODE_ENV || 'test',
            PATH: process.env.PATH,
            PGHOST: '127.0.0.1',
            PGPORT: String(port),
            PGUSER: 'library_check_app',
            PGPASSWORD: password,
            PGSSLMODE: 'verify-full',
            PGSSLROOTCERT: join(tlsDir, 'ca.pem'),
            PGCONNECT_TIMEOUT: '5',
          },
          stdio: 'ignore',
          timeout: 20000,
        },
      )
      const restored = pool('library_check_app', 'library_restore_check')
      assert.equal(
        (await restored.query('select count(*)::int n from "user"')).rows[0].n,
        0,
      )
      assert.equal(
        (await restored.query('select count(*)::int n from schema_migrations'))
          .rows[0].n,
        0,
      )
      assert.equal((await preflight(restored)).schemaHash, plan.schemaHash)
      result.migrationPackage = {
        checksPassed: true,
        backupMode: '0600',
        backupRestoredToOwnedDisposableDatabase: true,
        rowDataExcluded: true,
        productionApplied: false,
      }
    },
  )
  await application.query('create table "user" (id text primary key)')
  await application.query(migration)
  for (const owner of [
    'race',
    'retry',
    'reuse',
    'locked',
    'other',
    'rollback',
    'reader-own',
  ])
    await application.query('insert into "user" (id) values ($1)', [owner])
  await check(
    'eight simultaneous first writes create one revision and preserve losers',
    async () => {
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          writeLibraryForUser('race', write(0, 'First ' + i), app),
        ),
      )
      assert.equal(outcomes.filter((r) => r.kind === 'ok').length, 1)
      assert.equal(outcomes.filter((r) => r.kind === 'conflict').length, 7)
      assert.equal((await loadLibraryForUser('race', app)).revision, 1)
      assert.equal(
        (
          await application.query(
            "select count(*)::int n from library_study_write where user_id='race'",
          )
        ).rows[0].n,
        1,
      )
      assert(backends.size >= 2)
      result.distinctTransactionBackends = backends.size
    },
  )
  await check(
    'eight existing-row writers preserve the expected revision',
    async () => {
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          writeLibraryForUser('race', write(1, 'Update ' + i), app),
        ),
      )
      assert.equal(outcomes.filter((r) => r.kind === 'ok').length, 1)
      assert.equal(outcomes.filter((r) => r.kind === 'conflict').length, 7)
      assert.equal((await loadLibraryForUser('race', app)).revision, 2)
      assert.equal(
        (
          await application.query(
            "select count(*)::int n from library_study_write where user_id='race'",
          )
        ).rows[0].n,
        2,
      )
    },
  )
  await check(
    'concurrent identical retries share one receipt and acknowledgement',
    async () => {
      const request = write(0, 'Identical retry')
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () =>
          writeLibraryForUser('retry', request, app),
        ),
      )
      assert(
        outcomes.every((r) => r.kind === 'ok' && r.acknowledgedRevision === 1),
      )
      assert.equal(
        outcomes.filter((r) => r.kind === 'ok' && r.replayed).length,
        7,
      )
      assert.equal((await loadLibraryForUser('retry', app)).revision, 1)
      assert.equal(
        (
          await application.query(
            "select count(*)::int n from library_study_write where user_id='retry'",
          )
        ).rows[0].n,
        1,
      )
    },
  )
  await check(
    'concurrent request-ID reuse with changed content is refused',
    async () => {
      const requestId = randomUUID()
      const outcomes = await Promise.all(
        ['Left', 'Right'].map((text) =>
          writeLibraryForUser('reuse', write(0, text, requestId), app),
        ),
      )
      assert.equal(outcomes.filter((r) => r.kind === 'ok').length, 1)
      assert.equal(
        outcomes.filter((r) => r.kind === 'request_id_reused').length,
        1,
      )
    },
  )
  await writeLibraryForUser('locked', write(0, 'Before lock'), app)
  await check(
    'one owner row lock does not block an independent owner',
    async () => {
      const holder = await application.connect()
      await holder.query('begin')
      await holder.query(
        "select * from library_study_snapshot where user_id='locked' for update",
      )
      let settled = false
      const waiting = writeLibraryForUser(
        'locked',
        write(1, 'After lock'),
        db(application, 'blocked'),
      ).finally(() => {
        settled = true
      })
      try {
        let observed = false
        const deadline = Date.now() + 1500
        while (Date.now() < deadline) {
          observed =
            (
              await admin.query(
                "select count(*)::int n from pg_stat_activity where application_name=$1 and wait_event_type='Lock'",
                ['pathfinder-libcheck:blocked'],
              )
            ).rows[0].n > 0
          if (observed) break
          await pause(10)
        }
        assert.equal(observed, true)
        assert.equal(settled, false)
        assert.equal(
          (
            await bounded(
              writeLibraryForUser('other', write(0, 'Independent owner'), app),
              2000,
            )
          ).kind,
          'ok',
        )
        assert.equal(settled, false)
        await holder.query('commit')
        assert.equal((await waiting).kind, 'ok')
      } finally {
        await holder.query('rollback')
        holder.release()
        await waiting.catch(() => {})
      }
    },
  )
  await check(
    'three-second lock timeout rolls back without modifying the snapshot',
    async () => {
      const before = await loadLibraryForUser('locked', app),
        holder = await application.connect()
      await holder.query('begin')
      await holder.query(
        "select * from library_study_snapshot where user_id='locked' for update",
      )
      try {
        const start = performance.now()
        await expectCode(
          writeLibraryForUser(
            'locked',
            write(before.revision, 'Must not appear'),
            app,
          ),
          '55P03',
        )
        const elapsed = performance.now() - start
        assert(elapsed >= 2500 && elapsed < 6500)
        result.observedLockTimeoutMs = Math.round(elapsed)
      } finally {
        await holder.query('rollback')
        holder.release()
      }
      assert.deepEqual(await loadLibraryForUser('locked', app), before)
    },
  )
  await check(
    'receipt insertion failure rolls back the first snapshot too',
    async () => {
      await application.query(
        "create function fail_test_receipt() returns trigger language plpgsql as $$ begin if new.user_id='rollback' then raise exception 'forced verification failure'; end if; return new; end $$; create trigger fail_test_receipt before insert on library_study_write for each row execute function fail_test_receipt()",
      )
      await expectCode(
        writeLibraryForUser('rollback', write(0, 'Must roll back'), app),
        'P0001',
      )
      assert.equal(
        (
          await application.query(
            "select count(*)::int n from library_study_snapshot where user_id='rollback'",
          )
        ).rows[0].n,
        0,
      )
      await application.query(
        'drop trigger fail_test_receipt on library_study_write; drop function fail_test_receipt()',
      )
    },
  )
  await check(
    'non-owner role has no public privilege and RLS stays default-deny after a grant',
    async () => {
      const reader = pool(
        'library_check_reader',
        'cs_pathfinder_library_check',
        { max: 1 },
      )
      await expectCode(
        reader.query('select * from library_study_snapshot'),
        '42501',
      )
      await application.query(
        'grant select, insert on library_study_snapshot to library_check_reader',
      )
      assert.equal(
        (await reader.query('select * from library_study_snapshot')).rows
          .length,
        0,
      )
      await expectCode(
        reader.query(
          "insert into library_study_snapshot(user_id) values ('reader-own')",
        ),
        '42501',
      )
      await application.query(
        'revoke select, insert on library_study_snapshot from library_check_reader',
      )
    },
  )
  await check(
    'reapplying migration preserves records and nonempty rollback refuses deletion',
    async () => {
      const before = await loadLibraryForUser('race', app)
      await application.query(migration)
      assert.deepEqual(await loadLibraryForUser('race', app), before)
      const client = await application.connect()
      try {
        await expectCode(client.query(rollback), 'P0001')
      } finally {
        await client.query('rollback')
        client.release()
      }
      assert.deepEqual(await loadLibraryForUser('race', app), before)
    },
  )
  await check(
    'user deletion cascades and empty-only rollback/reapply works',
    async () => {
      await application.query('delete from "user" where id=\'race\'')
      assert.equal(
        (
          await application.query(
            "select count(*)::int n from library_study_snapshot where user_id='race'",
          )
        ).rows[0].n,
        0,
      )
      assert.equal(
        (
          await application.query(
            "select count(*)::int n from library_study_write where user_id='race'",
          )
        ).rows[0].n,
        0,
      )
      await application.query('delete from "user"')
      await application.query(rollback)
      assert.equal(
        (
          await application.query(
            "select to_regclass('public.library_study_snapshot') name",
          )
        ).rows[0].name,
        null,
      )
      await application.query(migration)
      assert.equal(
        (
          await application.query(
            'select count(*)::int n from library_study_snapshot',
          )
        ).rows[0].n,
        0,
      )
    },
  )
  result.passed = true
} catch (error) {
  result.passed = false
  result.failedStage = stage
  result.errorCode =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    /^[A-Z0-9_]{1,50}$/.test(String(error.code))
      ? String(error.code)
      : error instanceof Error && /^[A-Z_]{3,60}$/.test(error.message)
        ? error.message
        : 'VERIFICATION_FAILED'
  console.error(
    'FAIL ' +
      stage +
      ' (' +
      result.errorCode +
      '); no credentials or raw database errors printed',
  )
  process.exitCode = 1
} finally {
  await Promise.allSettled(pools.map((p) => p.end()))
  let stopped = !attemptedStart || !existsSync(join(data, 'postmaster.pid'))
  if (!stopped) {
    try {
      runBinary('pg_ctl', ['stop', '-D', data, '-m', 'fast', '-w', '-t', '10'])
      stopped = true
    } catch {
      process.exitCode = 1
      result.cleanupError = 'owned_cluster_stop_failed'
      result.passed = false
    }
  }
  result.clusterStopped = stopped
  if (stopped) {
    rmSync(run, { recursive: true, force: true })
    result.privateFixtureRemoved = true
  }
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n')
  console.log(
    'Report saved; production database and app environment were never used',
  )
}
