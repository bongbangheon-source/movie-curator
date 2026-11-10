import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3100",
    channel: "msedge",
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
  },
});
