import { ENDPOINTS } from "../../src/constants.js";
import { isStatusDocumented } from "../../src/contract/openapi.js";
import { expect, test } from "../fixtures.js";

/**
 * Runs first in CI. If the environment is down, this fails in seconds with an
 * obvious message instead of leaving 30 auth tests to time out mysteriously.
 */
test.describe("Health", () => {
  test(
    "API-HEALTH-01 service reports healthy",
    { tag: ["@health", "@smoke"] },
    async ({ health }) => {
      // Act
      const res = await health.get();

      // Assert
      expect(res.status, `GET ${ENDPOINTS.health} did not return 200. Is the environment up?`).toBe(
        200,
      );
      expect(isStatusDocumented(ENDPOINTS.health, "get", res.status)).toBe(true);
    },
  );

  test("API-HEALTH-02 health responds quickly", { tag: ["@health"] }, async ({ health }) => {
    // Act
    const res = await health.get();

    // Assert: a slow liveness probe means the environment is degraded.
    expect(res.ms, `Health check took ${res.ms}ms`).toBeLessThan(2_000);
  });

  test("API-HEALTH-03 health response is not cached", { tag: ["@health"] }, async ({ health }) => {
    // Act
    const res = await health.get();

    // Assert: a cached probe would report a stale service as healthy.
    const cacheControl = res.headers["cache-control"] ?? "";
    expect(cacheControl).toMatch(/no-store|no-cache|max-age=0/);
  });
});
