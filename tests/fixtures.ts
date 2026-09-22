import { test as base, expect, request } from "@playwright/test";
import { AuthClient } from "../src/clients/auth-client.js";
import { HealthClient } from "../src/clients/health-client.js";
import { config } from "../src/config.js";

/**
 * Fixtures.
 *
 * `auth` and `health` are worker-scoped: one request context per worker rather
 * than one per test, since they hold no per-test state.
 *
 * There is deliberately no "fresh user" fixture yet. The moment a test needs to
 * change account state (failed-attempt counters, lockout, password changes), add
 * a `freshUser` fixture backed by a test-only user-creation hook and use it
 * there. Never point such a test at `config.buyer`, which is shared and
 * read-only. See README, "Adding state-changing tests".
 */

interface WorkerFixtures {
  auth: AuthClient;
  health: HealthClient;
}

export const test = base.extend<object, WorkerFixtures>({
  auth: [
    async ({}, use) => {
      const ctx = await request.newContext({ baseURL: config.apiBaseUrl });
      await use(new AuthClient(ctx));
      await ctx.dispose();
    },
    { scope: "worker" },
  ],

  health: [
    async ({}, use) => {
      const ctx = await request.newContext({ baseURL: config.apiBaseUrl });
      await use(new HealthClient(ctx));
      await ctx.dispose();
    },
    { scope: "worker" },
  ],
});

export { expect };
