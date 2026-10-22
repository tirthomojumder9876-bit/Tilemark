import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT ?? 3100);
const external = process.env.E2E_BASE_URL;

const projects = [
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
];

// Firefox cannot launch on macOS 27 with the current Playwright build
// ("Could not find profile folder"), so it is opt-in and runs in CI on Linux.
if (process.env.PW_INCLUDE_FIREFOX === '1') {
  projects.push({
    name: 'firefox',
    use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
  });
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: external ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: external
    ? undefined
    : {
        command: 'node --env-file-if-exists=.env server/index.ts',
        url: `http://127.0.0.1:${PORT}/api/health`,
        env: { PORT: String(PORT) },
        reuseExistingServer: false,
        timeout: 30_000,
      },
  projects,
});
