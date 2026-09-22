import { defineConfig } from "@playwright/test";
import { config } from "./src/config.js";
import { TIMEOUTS } from "./src/constants.js";

/**
 * Projects are independent on purpose. `dependencies` is deliberately NOT used:
 * a dependent project is SKIPPED when its dependency fails, which would hide
 * whole areas of the suite behind one unrelated failure. CI orders the runs
 * instead (see .github/workflows/api-tests.yml).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }], ["junit", { outputFile: "results/junit.xml" }]],
  use: {
    baseURL: config.apiBaseUrl,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
      // Makes test traffic identifiable in server logs.
      "X-Test-Run": process.env.GITHUB_RUN_ID ?? "local",
    },
    actionTimeout: TIMEOUTS.request,
    trace: "off",
  },
  projects: [
    {
      name: "health",
      testMatch: /health\/.*\.spec\.ts/,
    },
    {
      name: "api",
      testMatch: /(auth|contract)\/.*\.spec\.ts/,
      // Captcha cases live in jwt-login-captcha.spec.ts and only run when on.
      testIgnore: config.altchaEnabled ? [] : [/jwt-login-captcha\.spec\.ts/],
    },
  ],
});
