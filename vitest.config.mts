import { defineConfig } from 'vitest/config';

// Only the pure-TS domain layer is unit tested (no React Native imports).
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
  },
});
