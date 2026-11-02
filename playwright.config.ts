import { defineConfig } from "@playwright/test";
const dataDir = process.env.BAGDAR_E2E_DATA_DIR || ".data/e2e-" + Date.now();
process.env.BAGDAR_E2E_DATA_DIR = dataDir;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    extraHTTPHeaders: { Origin: "http://localhost:3001" },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `BAGDAR_MODE=demo BAGDAR_DATA_DIR=${dataDir} npm run dev -- --port 3001`,
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
