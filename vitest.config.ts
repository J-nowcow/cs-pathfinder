import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['tests/env.ts'],
    // PGlite 인스턴스를 파일마다 새로 띄우면 느리다.
    // DB 테스트는 단일 스레드로 직렬 실행한다.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
