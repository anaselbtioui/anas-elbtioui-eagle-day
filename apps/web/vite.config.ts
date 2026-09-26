import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const domainSrc = path.resolve(rootDir, '../../packages/domain/src')

export default defineConfig({
  // Load VITE_* from monorepo root `.env` (same file as the API).
  envDir: path.resolve(rootDir, '../..'),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'brand/icon.png',
        'brand/logo-labas.png',
        'brand/icon-192.png',
        'brand/icon-512.png',
      ],
      manifest: {
        name: 'Med Assurance',
        short_name: 'Med Assurance',
        description: 'Guide après accident automobile au Maroc',
        theme_color: '#102860',
        background_color: '#F4EFE6',
        display: 'standalone',
        lang: 'fr',
        start_url: '/',
        icons: [
          {
            src: '/brand/icon.png',
            sizes: '1254x1254',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/brand/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
      },
    }),
  ],
  resolve: {
    alias: [
      { find: '@/domain', replacement: domainSrc },
      { find: '@', replacement: path.resolve(rootDir, './src') },
    ],
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
})
