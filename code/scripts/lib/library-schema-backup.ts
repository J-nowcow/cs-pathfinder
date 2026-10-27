import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { rootCertificates } from 'node:tls'
import { postgresPoolConfig } from '../../src/lib/db/postgres-config'
import { hash } from './library-migration'
/** Schema-only, no row data; callers must provide a fresh protected directory. */
export function schemaBackup(
  bin: string,
  directory: string,
  connectionString: string,
  ca = rootCertificates.join('\n'),
) {
  const u = new URL(postgresPoolConfig(connectionString).connectionString!)
  if ([...u.searchParams.keys()].some((k) => !['channel_binding'].includes(k)))
    throw Error('UNSUPPORTED_BACKUP_PARAMETER')
  if (!/^[A-Za-z0-9_-]+$/.test(decodeURIComponent(u.pathname.slice(1))))
    throw Error('UNSUPPORTED_DATABASE_NAME')
  const certificate = join(directory, 'public-roots.pem')
  const backup = join(directory, 'schema.dump')
  writeFileSync(certificate, ca, { mode: 0o600, flag: 'wx' })
  const env = {
    NODE_ENV: process.env.NODE_ENV || 'test',
    PATH: process.env.PATH,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: certificate,
    PGCONNECT_TIMEOUT: '10',
    PGAPPNAME: 'pathfinder-schema-only-backup',
  }
  writeFileSync(backup, '', { mode: 0o600, flag: 'wx' })
  const child = spawnSync(
    join(bin, 'pg_dump'),
    [
      '--format=custom',
      '--schema-only',
      '--schema=public',
      '--no-owner',
      '--no-privileges',
      '--no-password',
      '--lock-wait-timeout=3000',
      '--file',
      backup,
    ],
    { env, stdio: ['ignore', 'ignore', 'pipe'], timeout: 60000 },
  )
  if (child.error || child.status !== 0 || child.stderr?.length) {
    const stderr = child.stderr?.toString() || ''
    const reason = /server version.*pg_dump version/s.test(stderr)
      ? 'DUMP_VERSION_MISMATCH'
      : /certificate|SSL error|TLS/i.test(stderr)
        ? 'DUMP_TLS_FAILED'
        : /permission denied/i.test(stderr)
          ? 'DUMP_PERMISSION_DENIED'
          : /unrecognized configuration parameter/i.test(stderr)
            ? 'DUMP_CONFIGURATION_UNSUPPORTED'
            : /password|authentication/i.test(stderr)
              ? 'DUMP_AUTHENTICATION_FAILED'
              : /warning:/i.test(stderr) && child.status === 0
                ? 'DUMP_WARNINGS_REQUIRE_REVIEW'
                : 'SCHEMA_BACKUP_FAILED'
    throw Error(reason)
  }
  chmodSync(backup, 0o600)
  const list = execFileSync(join(bin, 'pg_restore'), ['--list', backup], {
    env: { NODE_ENV: process.env.NODE_ENV || 'test', PATH: process.env.PATH },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 10000,
  })
  if (/TABLE DATA|SEQUENCE SET|BLOB DATA/.test(list))
    throw Error('BACKUP_CONTAINS_DATA')
  const bytes = readFileSync(backup)
  return { backupHash: hash(bytes), bytes: bytes.length, schemaOnly: true }
}
