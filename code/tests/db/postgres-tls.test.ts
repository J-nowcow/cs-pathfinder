import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Socket } from 'node:net'
import { createSecureContext, TLSSocket } from 'node:tls'
import { postgresPoolConfig } from '@/lib/db/postgres-config'

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pathfinder-tls-'))
  const openssl = (...args: string[]) =>
    execFileSync('openssl', args, { cwd: dir, stdio: 'ignore' })
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
    '/CN=Pathfinder Test CA',
  )
  for (const name of ['localhost', 'wrong.invalid']) {
    openssl(
      'req',
      '-new',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      name + '.key',
      '-out',
      name + '.csr',
      '-subj',
      '/CN=' + name,
    )
    writeFileSync(
      join(dir, name + '.ext'),
      'subjectAltName=DNS:' + name + '\nextendedKeyUsage=serverAuth\n',
    )
    openssl(
      'x509',
      '-req',
      '-in',
      name + '.csr',
      '-CA',
      'ca.pem',
      '-CAkey',
      'ca.key',
      '-CAcreateserial',
      '-out',
      name + '.pem',
      '-days',
      '1',
      '-extfile',
      name + '.ext',
    )
  }
})
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

// A minimal loopback PostgreSQL SSL upgrade and startup, never a real database.
async function withServer(name: string, run: (port: number) => Promise<void>) {
  const sockets = new Set<Socket>()
  const secureContext = createSecureContext({
    key: readFileSync(join(dir, name + '.key')),
    cert: readFileSync(join(dir, name + '.pem')),
  })
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    let request = Buffer.alloc(0)
    function upgrade(data: Buffer) {
      request = Buffer.concat([request, data])
      if (request.length < 8) return
      socket.off('data', upgrade)
      if (request.readInt32BE(0) !== 8 || request.readInt32BE(4) !== 80877103)
        return socket.destroy()
      socket.write('S')
      const tls = new TLSSocket(socket, { isServer: true, secureContext })
      tls.on('error', () => {})
      let startup = true
      tls.on('data', () => {
        if (startup) {
          startup = false
          tls.write(
            Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73]),
          )
        } else tls.end()
      })
    }
    socket.on('data', upgrade)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await run((server.address() as { port: number }).port)
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

describe('verified PostgreSQL TLS', () => {
  it.each([
    'sslmode=disable',
    'sslmode=no-verify',
    'ssl=no-verify',
    'ssl=0',
    'sslmode=require&uselibpqcompat=true',
    'sslnegotiation=direct',
  ])('cannot weaken verification through %s', (query) => {
    const config = postgresPoolConfig(
      'postgres://test:p%40ss@localhost/library?' + query,
    )
    const client = new Client(config)
    expect(client.ssl).toEqual({ rejectUnauthorized: true })
    expect(new URL(config.connectionString!).password).toBe('p%40ss')
  })
  it('keeps application options, caps connection wait, and does not mutate the original URL', () => {
    const input =
      'postgresql://test:secret@localhost/library?application_name=pathfinder&sslmode=require'
    const config = postgresPoolConfig(input)
    expect(
      new URL(config.connectionString!).searchParams.get('application_name'),
    ).toBe('pathfinder')
    expect(input).toContain('sslmode=require')
    expect(config.connectionTimeoutMillis).toBe(10_000)
  })
  it.each(['sslcert', 'sslkey', 'sslrootcert'])(
    'refuses unsupported %s without reading a file or leaking credentials',
    (key) => {
      expect(() =>
        postgresPoolConfig(
          'postgres://secret-user:secret-pass@localhost/db?' +
            key +
            '=/private/file',
        ),
      ).toThrow(/^Certificate file parameters are unsupported/)
    },
  )
  it.each([
    'not-a-url-secret',
    'https://secret-user:secret-pass@localhost/db',
    'postgres:///db',
    'postgres://test:test@localhost/db?host=/tmp',
    'postgres://test:test@%2Ftmp/db',
  ])('redacts invalid or non-TCP connection input', (input) => {
    expect(() => postgresPoolConfig(input)).toThrow(
      'DATABASE_URL must be a PostgreSQL TCP URL.',
    )
  })
  it('rejects an untrusted certificate during the actual pg TLS handshake', async () => {
    await withServer('localhost', async (port) => {
      const client = new Client({
        ...postgresPoolConfig(`postgres://test:test@localhost:${port}/db`),
        connectionTimeoutMillis: 2000,
      })
      try {
        await expect(client.connect()).rejects.toMatchObject({
          code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        })
      } finally {
        await client.end().catch(() => {})
      }
    })
  })
  it('rejects a trusted certificate for the wrong hostname', async () => {
    await withServer('wrong.invalid', async (port) => {
      const config = postgresPoolConfig(
        `postgres://test:test@localhost:${port}/db`,
      )
      const client = new Client({
        ...config,
        ssl: {
          ...(config.ssl as object),
          ca: readFileSync(join(dir, 'ca.pem')),
        },
        connectionTimeoutMillis: 2000,
      })
      try {
        await expect(client.connect()).rejects.toMatchObject({
          code: 'ERR_TLS_CERT_ALTNAME_INVALID',
        })
      } finally {
        await client.end().catch(() => {})
      }
    })
  })
  it('connects when both the CA and hostname match', async () => {
    await withServer('localhost', async (port) => {
      const config = postgresPoolConfig(
        `postgres://test:test@localhost:${port}/db`,
      )
      const client = new Client({
        ...config,
        ssl: {
          ...(config.ssl as object),
          ca: readFileSync(join(dir, 'ca.pem')),
        },
        connectionTimeoutMillis: 2000,
      })
      try {
        await client.connect()
        expect(
          (
            client as unknown as {
              connection: { stream: { authorized: boolean } }
            }
          ).connection.stream.authorized,
        ).toBe(true)
      } finally {
        await client.end().catch(() => {})
      }
    })
  })
})
