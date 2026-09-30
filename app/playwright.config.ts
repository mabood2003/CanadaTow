import { defineConfig, devices } from "@playwright/test";

// Runs against a production build (`npm run build` first). Uses the locally installed Chrome — no browser download.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    // TowLedger Driver is a phone app; TowLedger Owner runs on a laptop and a phone.
    { name: "phone", testMatch: /(flow|driver|customer)\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", testMatch: /(office|owner)\.spec\.ts/, use: { viewport: { width: 1366, height: 900 } } },
    { name: "owner-phone", testMatch: /owner\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "screens", testMatch: /screens\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
