import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

describe('public snapshots in actual React server requests', () => {
  it('reduces repeated reads without retaining values, failures or future-day misses across requests', async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--conditions=react-server',
        '--import',
        'tsx',
        'scripts/verify-public-render-reads.ts',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          USE_REAL_DB: '0',
          DATABASE_URL: '',
          NODE_TLS_REJECT_UNAUTHORIZED: '1',
        },
        timeout: 25_000,
      },
    )
    const line = stdout
      .split('\n')
      .find((value) => value.startsWith('PUBLIC_RENDER_READS '))
    expect(line).toBeDefined()
    const report = JSON.parse(line!.slice('PUBLIC_RENDER_READS '.length))
    expect(report.nodeQueries).toEqual({ before: 4, after: 2 })
    expect(report.treeQueries).toEqual({ before: 4, after: 2 })
    expect(report.checks).toHaveLength(8)
    expect(report.productionAccess).toBe(false)
  })
})
