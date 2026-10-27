import type { PoolConfig } from 'pg'

/** URL의 SSL 옵션이 검증 설정을 덮어쓰지 않게 한다. */
export function postgresPoolConfig(connectionString: string): PoolConfig {
  let url: URL
  try {
    url = new URL(connectionString)
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      /[/\\]/.test(decodeURIComponent(url.hostname)) ||
      url.searchParams.has('host')
    ) {
      throw new Error('invalid')
    }
  } catch {
    // Do not include connection strings or parser errors containing credentials.
    throw new Error('DATABASE_URL must be a PostgreSQL TCP URL.')
  }
  for (const key of ['sslcert', 'sslkey', 'sslrootcert']) {
    if (url.searchParams.has(key)) {
      throw new Error(
        'Certificate file parameters are unsupported by the public-CA database connection.',
      )
    }
  }
  for (const key of ['ssl', 'sslmode', 'uselibpqcompat', 'sslnegotiation']) {
    url.searchParams.delete(key)
  }
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  }
}
