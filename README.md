# books-api-tests-ts

API test suite for the **Books Library public REST** API. Covers the health
probe and `POST /auth/jwt/login`.

Written with Playwright's API testing mode (no browser). The suite is the
starting point for further auth work — see
[Adding state-changing tests](#adding-state-changing-tests) before writing
anything that mutates an account.

## TypeScript setup

| Setting                                 | Value  | Why                                                                                      |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `strict`                                | `true` | Every strict-family check on                                                             |
| `noUncheckedIndexedAccess`              | `true` | `array[0]` is `T \| undefined`, so an empty result cannot slip through as a passing test |
| `noUnusedLocals` / `noUnusedParameters` | `true` | A leftover import or unused fixture fails the build                                      |
| `verbatimModuleSyntax`                  | `true` | Type-only imports are explicit; `consistent-type-imports` enforces it                    |
| `noEmit`                                | `true` | Playwright transpiles at run time; `tsc` is a type gate only                             |

`npm run typecheck` is the first CI step, so a type error fails in seconds
rather than partway through a suite.

## Quick start

```bash
nvm use                 # Node 22, per .nvmrc
npm ci
cp .env.example .env    # then edit it
npm run verify          # typecheck + lint + format check
npm test
```

### Trying it without a backend

A mock of the auth API ships in `tools/mock-api/` so the harness can be run
before a real environment is available:

```bash
npm run mock-api &      # listens on http://localhost:8080
npm test                # captcha tests run only when ALTCHA_ENABLED=true
```

To exercise captcha against the mock, set `ALTCHA_ENABLED=true` in `.env`
and start both sides:

```bash
npm run mock-api &
npm test
```

**A green run against the mock proves the harness works and nothing about the
product.** Point `API_BASE_URL` at a real deployment for a meaningful run. CI
never uses the mock.

## What is covered

| Area                   | Tests                   | Notes                                                                   |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Health                 | `API-HEALTH-01..03`     | Status, latency, no caching                                             |
| JWT login, happy path  | `API-AUTH-01..03`       | Token pair, JWT claims, `Cache-Control: no-store`                       |
| JWT login, credentials | `API-AUTH-04..06`       | 401 shape, user enumeration, no attempt counter                         |
| JWT login, validation  | `API-AUTH-07` (6 cases) | Missing, empty and wrong-typed fields                                   |
| JWT login, captcha     | `API-AUTH-08..10`       | Missing, malformed, replayed. Collected only when `ALTCHA_ENABLED=true` |
| JWT login, robustness  | `API-AUTH-11..12`       | Oversized input, unusual usernames                                      |
| Contract               | `API-CONTRACT-01..05`   | Request bodies and status codes against the OpenAPI spec                |

Run a slice:

```bash
npm run test:health     # @health
npm run test:smoke      # @smoke
npm run test:security   # @security, retries disabled
npx playwright test --grep @security --repeat-each=5
```

## Layout

```
openapi/books-api.yaml       Trimmed spec: the paths this suite exercises
src/config.ts                Environment config, validated at import
src/constants.ts             Endpoints, error codes, timeouts
src/altcha.ts                Proof-of-work solver for the login captcha
src/clients/                 HTTP clients: return results, never assert
src/schemas/                 zod response contracts + JWT decoding
src/contract/openapi.ts      Request and status-code validation against the spec
tests/health/                Health probe
tests/auth/                  POST /auth/jwt/login
tests/contract/              Spec conformance
tools/mock-api/              Local stand-in for the auth API (not for real testing)
```

## Design rules this repo follows

- **Clients return `{ status, headers, body, ms }`; tests assert.** No hidden
  client state such as `lastStatus`, so tests are readable and parallel-safe.
- **Arrange / Act / Assert** in every test, with the captcha solved during
  Arrange so `ms` measures only the request.
- **Worker-scoped fixtures** for request contexts; nothing is shared that a test
  can mutate.
- **`.strict()` response schemas**: an unexpected extra field fails the test.
  That is how a leaked `failedAttempts` field gets caught.
- **Projects have no `dependencies`.** A dependent Playwright project is
  _skipped_ when its dependency fails, which would hide whole areas behind one
  unrelated failure. CI orders the runs instead.
- **Security tests never retry** (`npm run test:security` sets `--retries=0`).
  A retry can mask a real race condition.

## Adding state-changing tests

Everything here is read-only with respect to account state, which is why the
suite runs in parallel against one shared seeded account (`BUYER_*`).

The **account lockout** feature changes that. A test that drives failed-attempt
counters must not touch the shared buyer: it would lock an account other tests
and other suites depend on.

Before writing those tests, ask the backend team for test-only hooks
(non-production, token-protected):

| Hook                                    | Why it is needed                                 |
| --------------------------------------- | ------------------------------------------------ |
| `POST /test-hooks/users`                | A disposable user per test                       |
| `DELETE /test-hooks/lockout/{username}` | Reset counter and lock in teardown               |
| `GET /test-hooks/lockout/{username}`    | Assert counter state directly                    |
| `POST /test-hooks/clock/advance`        | Test a 15-minute lock without waiting 15 minutes |

Then add a `freshUser` fixture in `tests/fixtures.ts` (test-scoped, creating a
user in setup and resetting it in teardown) and use it for every state-changing
test. Keep clock-dependent tests in their own Playwright project running with
`--workers=1`, because a server clock offset is global.

## Known spec gaps

These are findings against the published OpenAPI document, not test bugs.
Each is visible in the suite rather than worked around.

| Gap                                             | Where it shows                            | Action                                                                              |
| ----------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `401` is not documented for `/auth/jwt/login`   | `API-CONTRACT-05`, marked `test.fail`     | Backend to document it; then delete the `test.fail` line                            |
| `/health` is not in the published spec          | Added locally in `openapi/books-api.yaml` | Confirm the real path and add it upstream                                           |
| The ALTCHA challenge endpoint is not documented | `ALTCHA_CHALLENGE_PATH` env var           | Confirm the path and add it upstream                                                |
| The `200` response has no schema                | `src/schemas/auth.schemas.ts`             | Add response schemas upstream, then generate types and delete the hand-written file |

## Open questions for the team

- Should usernames be compared case-insensitively, and is surrounding
  whitespace trimmed? `API-AUTH-12` currently only asserts the endpoint answers
  cleanly.
- Is `403` returned when a non-public role uses this endpoint? If so it needs a
  test and a spec entry.
- What is the intended `Cache-Control` on the token response? The suite asserts
  `no-store`.

## Environment variables

See `.env.example`. Copy it to `.env` for local runs; `src/config.ts` loads
that file at import time. Variables already set in the process (CI, the shell)
are not overwritten.

`API_BASE_URL`, `BUYER_USERNAME` and `BUYER_PASSWORD` are required; the rest
have defaults. A missing variable fails fast with a message naming it.

`ALTCHA_ENABLED` is off unless set to `true`. When it is false or unset, login
requests omit the captcha field and `API-AUTH-08..10` are not collected.
