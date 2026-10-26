import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "output/ux-redesign/test-results",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "output/ux-redesign/playwright-report", open: "never" },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:1425",
    viewport: { width: 1280, height: 860 },
    locale: "en-US",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...((process.env.PLAYWRIGHT_CHANNEL || process.platform === "win32")
      ? { channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" }
      : {}),
  },
  webServer: {
    command: "pnpm --filter @vibehub/desktop dev --host 127.0.0.1 --port 1425",
    url: "http://127.0.0.1:1425",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
