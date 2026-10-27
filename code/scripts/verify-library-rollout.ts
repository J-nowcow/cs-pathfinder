/** Build-only gate. Environment comes from the build; never reads private env files. */
import { Pool } from 'pg'
import { postgresPoolConfig } from '../src/lib/db/postgres-config'
import {
  rolloutConfiguration,
  verifyRolloutSchema,
} from './lib/library-rollout'
let pool: Pool | undefined
try {
  const config = rolloutConfiguration(process.env)
  if (!config) {
    console.log(
      'Library account rollout disabled; no database readiness connection.',
    )
  } else {
    pool = new Pool(postgresPoolConfig(config.connectionString))
    const checked = await verifyRolloutSchema(pool)
    console.log(
      JSON.stringify({
        libraryRolloutReadiness: true,
        targetFingerprint: config.targetFingerprint,
        ...checked,
        oauthVerified: false,
      }),
    )
  }
} catch (error) {
  const code =
    error instanceof Error && /^LIBRARY_[A-Z_]+$/.test(error.message)
      ? error.message
      : 'LIBRARY_READINESS_FAILED'
  console.error(
    'Library rollout build refused: ' +
      code +
      '. No raw environment/database details printed.',
  )
  process.exitCode = 1
} finally {
  await pool?.end()
}
