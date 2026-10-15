/**
 * End-to-end tests run the exported web bundle (Expo Router's static export)
 * against Playwright's own browser: the phone breakpoint in a browser is the
 * same React tree the Android WebView-free native build renders, so language,
 * routing and business flow are verified exactly as they ship.
 *
 * API calls are stubbed per test with page.route(), so the suite never needs
 * a live server or network access.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 8081;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "phone-chrome",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  webServer: {
    command: "bun run serve:dist",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
