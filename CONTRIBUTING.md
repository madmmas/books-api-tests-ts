# Contributing

## Before you open a PR

- [ ] `npm run verify` passes (typecheck, lint, format)
- [ ] `npx playwright test --repeat-each=5` passes for any test you added
- [ ] Test title states exactly what is asserted (no "or" in a single test)
- [ ] Test ID follows the convention and is traceable to an acceptance criterion
- [ ] Arrange / Act / Assert are visibly separate
- [ ] No sleeps, no shared mutable state, no `test.only`
- [ ] Security tests carry `@security` and do not rely on retries
- [ ] No new magic values: endpoints in `src/constants.ts`, settings in `src/config.ts`
- [ ] README updated if setup or environment variables changed

## Test ID convention

`API-<AREA>-<NN>` — for example `API-AUTH-04`, `API-HEALTH-01`, `API-CONTRACT-02`.
IDs are stable. When a test is deleted its ID is retired, never reused.

## Commit messages

Conventional commits:

```
test(auth): cover captcha replay on jwt login
fix(client): return headers from AuthClient.postLogin
ci: run security tests without retries
chore(deps): bump @playwright/test to 1.49.1
```
