/** Manual operations command. Preparing never authorizes applying. No seed/general runner. */
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { postgresPoolConfig } from '../src/lib/db/postgres-config'
import {
  applyOnlyLibrary,
  hash,
  migrationName,
  preflight,
  reviewedSqlHash,
  targetIdentity,
  type MigrationPlan,
} from './lib/library-migration'
import { schemaBackup } from './lib/library-schema-backup'
const sqlHash = reviewedSqlHash
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
let pool: Pool | undefined
let stage = 'arguments'
function argument(name: string) {
  const value = args[args.indexOf(name) + 1]
  if (!args.includes(name) || !value) throw Error('ARGUMENT_REQUIRED')
  return value
}
function absolute(name: string) {
  const value = argument(name)
  if (!isAbsolute(value)) throw Error('ABSOLUTE_PATH_REQUIRED')
  return value
}
function privateFile(path: string) {
  const s = lstatSync(path)
  if (!s.isFile() || (s.mode & 0o077) !== 0)
    throw Error('PRIVATE_FILE_REQUIRED')
  return readFileSync(path)
}
try {
  const mode = args[0]
  const allowed =
    mode === 'prepare'
      ? ['--env-file', '--target', '--bin-dir', '--private-dir']
      : mode === 'apply'
        ? ['--env-file', '--target', '--plan', '--approve-target']
        : []
  if (
    args.length !== 9 ||
    allowed.length !== 4 ||
    args
      .slice(1)
      .filter((_, i) => i % 2 === 0)
      .some((x) => !allowed.includes(x)) ||
    new Set(args.slice(1).filter((_, i) => i % 2 === 0)).size !== 4
  )
    throw Error('ARGUMENTS_REFUSED')
  // Read only this one named value. Do not load app env or execute/interpolate its contents.
  stage = 'configuration'
  const lines = readFileSync(absolute('--env-file'), 'utf8')
    .split(/\r?\n/)
    .filter((s) => /^DATABASE_URL=/.test(s))
  if (lines.length !== 1) throw Error('DATABASE_CONFIGURATION_REQUIRED')
  const value = lines[0].slice('DATABASE_URL='.length).trim()
  const connectionString = /^(['"]).*\1$/.test(value)
    ? value.slice(1, -1)
    : value
  stage = 'target'
  const target = targetIdentity(connectionString)
  if (
    !/^[a-f0-9]{16}$/.test(argument('--target')) ||
    target.fingerprint !== argument('--target')
  )
    throw Error('TARGET_REFUSED')
  const sql = readFileSync(
    join(source, 'supabase/migrations', migrationName),
    'utf8',
  )
  if (hash(sql) !== sqlHash) throw Error('UNREVIEWED_SQL')
  pool = new Pool(postgresPoolConfig(connectionString))
  if (mode === 'prepare') {
    const parent = absolute('--private-dir')
    mkdirSync(parent, { recursive: true, mode: 0o700 })
    // No backup in the repository or a symlinked location. Existing parent must already be private.
    if (
      lstatSync(parent).isSymbolicLink() ||
      (lstatSync(parent).mode & 0o077) !== 0
    )
      throw Error('PRIVATE_DIRECTORY_REQUIRED')
    const actual = realpathSync(parent)
    if (!relative(resolve(source, '..'), actual).startsWith('..'))
      throw Error('BACKUP_IN_REPOSITORY_REFUSED')
    stage = 'read_only_preflight'
    const before = await preflight(pool)
    const run = mkdtempSync(join(actual, 'library-migration-'))
    chmodSync(run, 0o700)
    stage = 'schema_only_backup'
    const backup = schemaBackup(absolute('--bin-dir'), run, connectionString)
    stage = 'read_only_recheck'
    const after = await preflight(pool)
    if (before.schemaHash !== after.schemaHash)
      throw Error('SCHEMA_CHANGED_DURING_BACKUP')
    const plan: MigrationPlan = {
      version: 1,
      createdAt: new Date().toISOString(),
      target,
      migration: migrationName,
      sqlHash,
      schemaHash: after.schemaHash,
      backupHash: backup.backupHash,
    }
    writeFileSync(
      join(run, 'plan.json'),
      JSON.stringify(plan, null, 2) + '\n',
      { mode: 0o600, flag: 'wx' },
    )
    console.log(
      JSON.stringify(
        {
          ...plan,
          preflight: after.flags,
          backup,
          planPath: join(run, 'plan.json'),
          productionWrites: false,
          rolloutEnabled: false,
        },
        null,
        2,
      ),
    )
  } else {
    if (argument('--approve-target') !== target.fingerprint)
      throw Error('EXPLICIT_TARGET_ARGUMENT_REQUIRED')
    stage = 'approved_apply'
    const planPath = absolute('--plan')
    const parent = dirname(planPath)
    if (
      lstatSync(parent).isSymbolicLink() ||
      (lstatSync(parent).mode & 0o077) !== 0
    )
      throw Error('PRIVATE_DIRECTORY_REQUIRED')
    const plan = JSON.parse(privateFile(planPath).toString()) as MigrationPlan
    const backup = privateFile(join(parent, 'schema.dump'))
    console.log(
      JSON.stringify(
        await applyOnlyLibrary(pool, plan, connectionString, sql, backup),
      ),
    )
  }
} catch (error) {
  // No driver exception, stderr, URL, query parameters, DDL or private file content is printed.
  console.error(
    'Library migration command refused or failed at ' +
      stage +
      '. No raw connection/file/database details printed.',
  )
  if (error instanceof Error && /^[A-Z_]{3,60}$/.test(error.message))
    console.error('Reason: ' + error.message)
  process.exitCode = 1
} finally {
  await pool?.end()
}
