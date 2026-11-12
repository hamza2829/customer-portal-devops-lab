import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './smoke',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['junit', { outputFile: process.env.SMOKE_XML ?? '../reports/smoke.xml' }]],
  use: { baseURL: process.env.PORTAL_BASE_URL ?? 'http://127.0.0.1:3000' },
});
