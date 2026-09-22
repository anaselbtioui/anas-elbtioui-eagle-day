import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const domainSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/domain/src')

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@labas\/domain\/(.*)$/,
        replacement: `${domainSrc}/$1`,
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
  },
})
