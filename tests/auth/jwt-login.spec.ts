import { config } from "../../src/config.js";
import { ERROR_CODES } from "../../src/constants.js";
import {
  AccessTokenClaimsSchema,
  decodeJwtPayload,
  ErrorSchema,
  LoginSuccessSchema,
} from "../../src/schemas/auth.schemas.js";
import { expect, test } from "../fixtures.js";

/**
 * POST /auth/jwt/login
 *
 * Every test here is read-only with respect to account state, so they are safe
 * to run in parallel against the shared seeded buyer. Anything that changes
 * state (failed-attempt counters, lockout) needs its own disposable user --
 * see README, "Adding state-changing tests".
 */
test.describe("JWT login", () => {
  test(
    "API-AUTH-01 valid credentials return a usable token pair",
    { tag: ["@smoke"] },
    async ({ auth }) => {
      // Arrange
      const { username, password } = config.buyer;

      // Act
      const res = await auth.login(username, password);

      // Assert
      expect(res.status).toBe(200);
      const body = LoginSuccessSchema.parse(res.body);
      expect(body.user.username).toBe(username);
      expect(body.accessToken).not.toBe(body.refreshToken);
    },
  );

  test("API-AUTH-02 access token carries valid claims", async ({ auth }) => {
    // Arrange
    const { username, password } = config.buyer;

    // Act
    const res = await auth.login(username, password);

    // Assert
    expect(res.status).toBe(200);
    const body = LoginSuccessSchema.parse(res.body);
    const claims = AccessTokenClaimsSchema.parse(decodeJwtPayload(body.accessToken));

    expect(claims.sub).toBe(body.user.id);
    expect(claims.exp).toBeGreaterThan(claims.iat);
    expect(claims.exp * 1000).toBeGreaterThan(Date.now());
  });

  test("API-AUTH-03 token response is not cacheable", { tag: ["@security"] }, async ({ auth }) => {
    // Act
    const res = await auth.login(config.buyer.username, config.buyer.password);

    // Assert: a cached token response can leak credentials via shared caches.
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"] ?? "").toMatch(/no-store/);
  });

  test(
    "API-AUTH-04 wrong password is rejected without a token",
    { tag: ["@smoke", "@security"] },
    async ({ auth }) => {
      // Act
      const res = await auth.login(config.buyer.username, "definitely-not-the-password");

      // Assert
      expect(res.status).toBe(401);
      const body = ErrorSchema.parse(res.body);
      expect(body.code).toBe(ERROR_CODES.invalidCredentials);
      expect(res.body).not.toHaveProperty("accessToken");
      expect(res.body).not.toHaveProperty("refreshToken");
    },
  );

  test(
    "API-AUTH-05 unknown user is indistinguishable from a wrong password",
    { tag: ["@security"] },
    async ({ auth }) => {
      // Arrange
      const unknown = `ghost-${crypto.randomUUID()}@example.test`;

      // Act
      const wrongPassword = await auth.login(config.buyer.username, "definitely-not-it");
      const unknownUser = await auth.login(unknown, "definitely-not-it");

      // Assert: status, body shape and error code must all match, or the API
      // tells an attacker which usernames exist.
      expect(unknownUser.status).toBe(wrongPassword.status);
      expect(Object.keys(unknownUser.body as object).sort()).toEqual(
        Object.keys(wrongPassword.body as object).sort(),
      );
      expect((unknownUser.body as { code: string }).code).toBe(
        (wrongPassword.body as { code: string }).code,
      );
    },
  );

  test(
    "API-AUTH-06 error responses do not leak an attempt counter",
    { tag: ["@security"] },
    async ({ auth }) => {
      // Act
      const res = await auth.login(config.buyer.username, "definitely-not-it");

      // Assert: an attempt count tells an attacker how much budget is left
      // before lockout, and confirms the account exists.
      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty("failedAttempts");
      expect(JSON.stringify(res.body)).not.toMatch(/attempt|remaining/i);
    },
  );

  /**
   * Validation cases. The spec marks username and password as required with
   * minLength 1, so each of these must be rejected with 400.
   */
  const invalidBodies = [
    { name: "missing username", body: { password: config.buyer.password } },
    { name: "missing password", body: { username: config.buyer.username } },
    { name: "both missing", body: {} },
    { name: "empty username", body: { username: "", password: config.buyer.password } },
    { name: "empty password", body: { username: config.buyer.username, password: "" } },
    { name: "username is not a string", body: { username: 42, password: "x" } },
  ];

  for (const testCase of invalidBodies) {
    test(`API-AUTH-07 ${testCase.name} is rejected with 400`, async ({ auth }) => {
      // Arrange
      const body = await auth.withCaptcha({ ...testCase.body });

      // Act
      const res = await auth.postLogin(body);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty("accessToken");
    });
  }

  test("API-AUTH-11 oversized input is rejected cleanly", async ({ auth }) => {
    // Arrange
    const huge = "a".repeat(100_000);
    const body = await auth.withCaptcha({ username: huge, password: huge });

    // Act
    const res = await auth.postLogin(body);

    // Assert: a clean client error, never a 5xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("API-AUTH-12 unusual usernames do not crash the endpoint", async ({ auth }) => {
    // Arrange: the correct behaviour for case and whitespace is undecided
    // (see README, "Open questions"). What must hold either way is that the
    // endpoint answers cleanly instead of erroring.
    const variants = [
      config.buyer.username.toUpperCase(),
      ` ${config.buyer.username} `,
      "user'; DROP TABLE users;--",
      "\u0000null-byte",
      "emoji-\u{1F600}@example.test",
    ];

    for (const username of variants) {
      // Act
      const res = await auth.login(username, config.buyer.password);

      // Assert
      expect([200, 400, 401], `username variant: ${JSON.stringify(username)}`).toContain(
        res.status,
      );
    }
  });
});
