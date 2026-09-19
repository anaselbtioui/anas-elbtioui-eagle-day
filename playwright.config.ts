import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: 'npm run server',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        LABAS_IMPORT_MODE: 'fixture',
        LABAS_IMPORT_HEADLESS: '1',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /broker-desk|broker-import|later-desk|screenshots/,
    },
  ],
})
