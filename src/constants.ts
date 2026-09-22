/** Every endpoint this suite touches, in one place. */
export const ENDPOINTS = {
  health: "/health",
  jwtLogin: "/auth/jwt/login",
} as const;

/** Error codes the API is expected to return. Agreed with the backend team. */
export const ERROR_CODES = {
  invalidCredentials: "invalid_credentials",
  validationError: "validation_error",
  captchaRequired: "captcha_required",
  captchaInvalid: "captcha_invalid",
} as const;

/** Timeouts in milliseconds. */
export const TIMEOUTS = {
  /** Proof-of-work can take a few seconds on a slow CI runner. */
  captchaSolve: 20_000,
  request: 15_000,
} as const;
