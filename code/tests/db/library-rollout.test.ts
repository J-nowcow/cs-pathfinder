import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { rolloutConfiguration } from '../../scripts/lib/library-rollout'
import { targetIdentity } from '../../scripts/lib/library-migration'
const url =
  'postgres://synthetic:private-synthetic-password@db.example.invalid/library?sslmode=require'
const valid = () => ({
  LIBRARY_ACCOUNT_SYNC_ENABLED: '1',
  DATABASE_URL: url,
  LIBRARY_ACCOUNT_EXPECTED_DB: targetIdentity(url).fingerprint,
  LIBRARY_ACCOUNT_EXPECTED_ORIGIN: 'https://app.example.invalid',
  BETTER_AUTH_URL: 'https://app.example.invalid/',
  BETTER_AUTH_SECRET: 'synthetic-secret',
  AUTH_GOOGLE_ID: 'synthetic-id',
  AUTH_GOOGLE_SECRET: 'synthetic-oauth-secret',
})
describe('library rollout build configuration', () => {
  it('does not inspect credentials or need a database when rollout is off', () => {
    expect(rolloutConfiguration({ DATABASE_URL: 'not-a-url' })).toBeNull()
    expect(
      rolloutConfiguration({ ...valid(), LIBRARY_ACCOUNT_SYNC_ENABLED: '0' }),
    ).toBeNull()
  })
  it('requires a pinned target and distinguishes host and database changes', () => {
    expect(() =>
      rolloutConfiguration({ ...valid(), LIBRARY_ACCOUNT_EXPECTED_DB: '' }),
    ).toThrow('LIBRARY_EXPECTED_TARGET_REQUIRED')
    expect(() =>
      rolloutConfiguration({
        ...valid(),
        DATABASE_URL: url.replace(
          'db.example.invalid',
          'other.example.invalid',
        ),
      }),
    ).toThrow('LIBRARY_TARGET_MISMATCH')
    expect(() =>
      rolloutConfiguration({
        ...valid(),
        DATABASE_URL: url.replace('/library?', '/other?'),
      }),
    ).toThrow('LIBRARY_TARGET_MISMATCH')
    expect(rolloutConfiguration(valid())?.targetFingerprint).toBe(
      targetIdentity(url).fingerprint,
    )
    expect(
      rolloutConfiguration({
        ...valid(),
        DATABASE_URL: url.replace(
          'private-synthetic-password',
          'rotated-password',
        ),
      })?.targetFingerprint,
    ).toBe(targetIdentity(url).fingerprint)
  })
  it('requires an exact HTTPS auth origin, credentials and no callback query/userinfo', () => {
    for (const origin of [
      'http://app.example.invalid',
      'https://other.example.invalid',
      'https://user:pass@app.example.invalid',
      'https://app.example.invalid/path',
    ])
      expect(() =>
        rolloutConfiguration({
          ...valid(),
          LIBRARY_ACCOUNT_EXPECTED_ORIGIN: origin,
        }),
      ).toThrow('LIBRARY_AUTH_ORIGIN_MISMATCH')
    expect(() =>
      rolloutConfiguration({
        ...valid(),
        BETTER_AUTH_URL: 'https://app.example.invalid/?x=1',
      }),
    ).toThrow('LIBRARY_AUTH_ORIGIN_MISMATCH')
    expect(() =>
      rolloutConfiguration({ ...valid(), AUTH_GOOGLE_SECRET: '' }),
    ).toThrow('LIBRARY_AUTH_CONFIGURATION_REQUIRED')
    expect(() =>
      rolloutConfiguration({ ...valid(), DATABASE_URL: 'postgres://' }),
    ).toThrow()
  })
  it('sanitizes command failures and skips the network entirely for a disabled build', () => {
    const command = resolve('scripts/verify-library-rollout.ts')
    const disabled = spawnSync(process.execPath, ['--import', 'tsx', command], {
      env: {
        ...process.env,
        LIBRARY_ACCOUNT_SYNC_ENABLED: '0',
        DATABASE_URL: url,
      },
      encoding: 'utf8',
      timeout: 10000,
    })
    expect(disabled.status).toBe(0)
    expect(disabled.stdout).toContain('no database readiness connection')
    expect(disabled.stdout + disabled.stderr).not.toContain(
      'private-synthetic-password',
    )
    const bad = spawnSync(process.execPath, ['--import', 'tsx', command], {
      env: {
        ...process.env,
        ...valid(),
        LIBRARY_ACCOUNT_EXPECTED_DB: '0000000000000000',
      },
      encoding: 'utf8',
      timeout: 10000,
    })
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain('LIBRARY_TARGET_MISMATCH')
    for (const value of [
      'private-synthetic-password',
      'synthetic-oauth-secret',
      'db.example.invalid',
    ])
      expect(bad.stdout + bad.stderr).not.toContain(value)
  })
})
