import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // The foundation has no behavior yet. Remove this when adding the first test.
    passWithNoTests: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
