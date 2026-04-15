import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,          // autopilot plays ~2 full levels — give it time
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: "list",

  use: {
    baseURL: "http://localhost:4003",
    headless: false,           // show the browser so you can watch autopilot play
    viewport: { width: 1280, height: 800 },
    // Slow things down just enough to watch — remove for CI
    launchOptions: { slowMo: 0 },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:4003",
    reuseExistingServer: true,  // use already-running dev server if available
    timeout: 30_000,
  },
});
