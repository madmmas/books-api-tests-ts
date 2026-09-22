/**
 * Environment configuration, validated once at import time.
 *
 * A missing or malformed variable fails immediately with a message that names
 * the variable, instead of surfacing later as a confusing test failure.
 */

type TestEnv = "local" | "ci" | "staging" | "prod";

const TEST_ENVS: readonly TestEnv[] = ["local", "ci", "staging", "prod"];

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function asTestEnv(value: string): TestEnv {
  if (!TEST_ENVS.includes(value as TestEnv)) {
    throw new Error(`TEST_ENV must be one of ${TEST_ENVS.join(", ")} (got "${value}")`);
  }
  return value as TestEnv;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const config = {
  apiBaseUrl: stripTrailingSlash(required("API_BASE_URL", "http://localhost:8080")),
  env: asTestEnv(required("TEST_ENV", "local")),
  altchaChallengePath: required("ALTCHA_CHALLENGE_PATH", "/auth/altcha/challenge"),
  openApiSpecPath: required("OPENAPI_SPEC", "./openapi/books-api.yaml"),

  /**
   * Seeded account used only for the successful-login path.
   * Treat it as READ-ONLY: never run failed-attempt, lockout or password-change
   * tests against it, because other suites and other workers share it.
   */
  buyer: {
    username: required("BUYER_USERNAME", "buyer@example.com"),
    password: required("BUYER_PASSWORD", "Password123!"),
  },
} as const;

export const isProd = (): boolean => config.env === "prod";
