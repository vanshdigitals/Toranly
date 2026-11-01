/**
 * End-to-end tests against the REAL backend and Postgres, with the production build served
 * same-origin by FastAPI. AI answers come from recorded fixtures (APP_ENV=test,
 * AI_FAKE_PROVIDER=true), so no test reaches xAI or Groq and nothing costs money.
 *
 *   npm run e2e            (builds web/dist first; needs Postgres, see E2E_DATABASE_URL)
 */
import { defineConfig } from '@playwright/test';

const PORT = 8002;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql+psycopg://toranly:toranly@127.0.0.1:5432/toranly';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1, // one backend, shared AI limits
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_BROWSER_CHANNEL ?? 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `uv run --directory ../backend uvicorn app.main:app_factory --factory --port ${PORT} --no-access-log`,
    url: `http://localhost:${PORT}/api/v1/health/ready`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      APP_ENV: 'test',
      AI_FAKE_PROVIDER: 'true',
      STATIC_DIR: '../web/dist',
      DATABASE_URL,
      // Fixture providers replace both clients; these placeholders only switch AI on.
      XAI_API_KEY: 'e2e-fixture-only',
      GROQ_API_KEY: 'e2e-fixture-only',
      XAI_ACCOUNT_RPM: '1000',
      XAI_ACCOUNT_TPM: '10000000',
      GROQ_ACCOUNT_RPM: '1000',
      GROQ_ACCOUNT_TPM: '10000000',
      // Every test gets a new device cookie; 3 a day keeps E2E-5 short.
      AI_LIMIT_PER_DEVICE_PER_DAY: '3',
      AI_LIMIT_PER_DEVICE_PER_MINUTE: '50',
      AI_LIMIT_PER_IP_PER_DAY: '1000',
      AI_GLOBAL_DAILY_LIMIT: '1000',
      API_LIMIT_PER_IP_PER_MINUTE: '1000',
    },
  },
});
