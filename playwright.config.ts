import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "npm run build && node server/index.ts",
    url: `http://127.0.0.1:${port}/healthz`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
})
