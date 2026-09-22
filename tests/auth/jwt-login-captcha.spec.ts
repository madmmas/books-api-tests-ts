import { config } from "../../src/config.js";
import { ERROR_CODES } from "../../src/constants.js";
import { expect, test } from "../fixtures.js";

/**
 * Captcha cases for POST /auth/jwt/login.
 *
 * This file is excluded by playwright.config.ts unless ALTCHA_ENABLED=true,
 * so these tests never skip in-place (security tests must not be silently
 * skipped).
 */
test.describe("JWT login captcha", () => {
  test(
    "API-AUTH-08 login without a captcha is rejected",
    { tag: ["@security"] },
    async ({ auth }) => {
      // Act
      const res = await auth.login(config.buyer.username, config.buyer.password, {
        captcha: false,
      });

      // Assert
      expect(res.status).toBe(400);
      expect((res.body as { code?: string }).code).toBe(ERROR_CODES.captchaRequired);
      expect(res.body).not.toHaveProperty("accessToken");
    },
  );

  test("API-AUTH-09 a malformed captcha is rejected", { tag: ["@security"] }, async ({ auth }) => {
    // Act
    const res = await auth.login(config.buyer.username, config.buyer.password, {
      altcha: "not-a-real-altcha-payload",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty("accessToken");
  });

  test(
    "API-AUTH-10 a captcha solution cannot be replayed",
    { tag: ["@security"] },
    async ({ auth }) => {
      // Arrange: one solution, used twice.
      const altcha = await auth.freshCaptcha();
      const first = await auth.login(config.buyer.username, config.buyer.password, { altcha });
      expect(first.status, "the first use of a fresh captcha should succeed").toBe(200);

      // Act
      const replay = await auth.login(config.buyer.username, config.buyer.password, { altcha });

      // Assert: replayable solutions let a bot reuse one proof-of-work forever.
      expect(replay.status).toBe(400);
      expect(replay.body).not.toHaveProperty("accessToken");
    },
  );
});
