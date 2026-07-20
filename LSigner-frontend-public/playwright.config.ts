import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT
  ? parseInt(process.env.PLAYWRIGHT_PORT, 10)
  : 3001;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;
const CI = !!process.env.CI;
const DOCKER = !!process.env.PLAYWRIGHT_DOCKER;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(DOCKER && {
          launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          },
        }),
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `npx next start -p ${PORT}`
      : `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 60_000 : 30_000,
  },
});
