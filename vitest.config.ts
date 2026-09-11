import { defineConfig } from 'vitest/config'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

// Integration tests that open their own database connection (or unmock @/lib/db) write test
// rows; they only run against a disposable database named by TEST_DATABASE_URL (never the
// production DB). Detected by content so new DB-backed tests are gated automatically.
const DB_TEST_MARKER = /new PrismaClient\(|createPrismaClient\(|vi\.unmock\(\s*['"]@\/lib\/db['"]/
function databaseBackedTests(dir = 'tests/integration'): string[] {
  try {
    return readdirSync(resolve(__dirname, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.test\.tsx?$/.test(file))
      .map((file) => `${dir}/${file.replaceAll('\\', '/')}`)
      .filter((file) => DB_TEST_MARKER.test(readFileSync(resolve(__dirname, file), 'utf8')))
  } catch {
    return []
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', '.next', ...(process.env.TEST_DATABASE_URL ? [] : databaseBackedTests())],
    // Reset call history between tests so assertions never see a previous test's calls
    clearMocks: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['lib/db.ts', '**/*.d.ts', 'tests/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
