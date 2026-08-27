import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // A build leaves compiled copies of the tests in dist. Without this they run
    // a second time and the count quietly doubles.
    include: ['src/**/*.test.ts'],
  },
})
