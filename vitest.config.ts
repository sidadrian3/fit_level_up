import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    globalSetup: './vitest.global-setup.ts',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
