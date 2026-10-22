import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      BETTER_AUTH_SECRET: 'test-secret-for-vitest',
      UPSTASH_REDIS_REST_URL: 'https://test-redis-url.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      CRON_SECRET: 'test-cron-secret-0123456789',
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
    globalSetup: './vitest.global-setup.ts',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    fileParallelism: false,
  },
});
