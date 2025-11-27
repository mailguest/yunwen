import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.spec.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}', 'src/__tests__/**/*.spec.{ts,tsx}'],
  },
})
