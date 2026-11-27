import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && node server/index.ts",
    url: `http://127.0.0.1:${port}/healthz`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
})
