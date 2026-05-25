import { defineConfig, devices } from '@playwright/test'

/**
 * E2E через Playwright. Бэкенд не нужен — все /api/** запросы мокаются
 * внутри тестов (page.route). Поднимаем Vite dev-сервер на 5173.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PW_TEST: '1' },
  },
})
