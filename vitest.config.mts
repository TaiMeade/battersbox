import { defineConfig } from 'vitest/config';

// Pure-TS layers only (no React Native imports): the stats engine and sync.
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts', 'src/sync/**/*.test.ts'],
  },
});
