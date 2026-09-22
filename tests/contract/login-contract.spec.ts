import { config } from "../../src/config.js";
import { ENDPOINTS } from "../../src/constants.js";
import {
  documentedStatuses,
  isStatusDocumented,
  specPaths,
  validateRequestBody,
} from "../../src/contract/openapi.js";
import { expect, test } from "../fixtures.js";

/**
 * Contract tests keep the suite and the OpenAPI document honest about each
 * other. Where the spec is incomplete, the gap is reported here rather than
 * quietly worked around.
 */
test.describe("Login contract", () => {
  test("API-CONTRACT-01 the request this suite sends matches CredentialsBody", async ({ auth }) => {
    // Arrange
    const body = await auth.withCaptcha({
      username: config.buyer.username,
      password: config.buyer.password,
    });

    // Act
    const errors = validateRequestBody(ENDPOINTS.jwtLogin, "post", body);

    // Assert
    expect(errors, errors.join("; ")).toEqual([]);
  });

  test("API-CONTRACT-02 bodies the suite treats as invalid are invalid per the spec", () => {
    // Arrange: the same cases API-AUTH-07 sends.
    const invalid = [
      {},
      { password: "x" },
      { username: "x" },
      { username: "", password: "x" },
      { username: "x", password: "" },
      { username: 42, password: "x" },
    ];

    // Act + Assert
    for (const body of invalid) {
      const errors = validateRequestBody(ENDPOINTS.jwtLogin, "post", body);
      expect(
        errors.length,
        `spec accepts a body the API must reject: ${JSON.stringify(body)}`,
      ).toBeGreaterThan(0);
    }
  });

  test("API-CONTRACT-03 the 200 response status is documented", async ({ auth }) => {
    // Act
    const res = await auth.login(config.buyer.username, config.buyer.password);

    // Assert
    expect(res.status).toBe(200);
    expect(isStatusDocumented(ENDPOINTS.jwtLogin, "post", res.status)).toBe(true);
  });

  test("API-CONTRACT-04 the suite only targets documented paths", () => {
    // Assert: adding a call to an undocumented endpoint should fail here first.
    const used = Object.values(ENDPOINTS);
    expect(specPaths()).toEqual(expect.arrayContaining(used));
  });

  /**
   * KNOWN SPEC GAP. The published spec documents only 200 and 400 for
   * /auth/jwt/login, but the API returns 401 for bad credentials. This test is
   * marked as expected-to-fail: when backend documents 401, Playwright reports
   * "expected to fail but passed", which is the signal to delete the marker.
   * Tracked in README, "Known spec gaps".
   */
  test("API-CONTRACT-05 the 401 response status is documented", async ({ auth }) => {
    test.fail(true, "Spec gap: 401 is not documented for /auth/jwt/login yet");

    // Act
    const res = await auth.login(config.buyer.username, "definitely-not-it");

    // Assert
    expect(res.status).toBe(401);
    expect(
      isStatusDocumented(ENDPOINTS.jwtLogin, "post", res.status),
      `documented statuses: ${documentedStatuses(ENDPOINTS.jwtLogin, "post").join(", ")}`,
    ).toBe(true);
  });
});
