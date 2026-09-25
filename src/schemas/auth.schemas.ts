import { z } from "zod";

/**
 * Response contracts for /auth/jwt/login.
 *
 * ASSUMPTION: the published spec documents the 200 response only as
 * "User and tokens" with no schema, so these shapes were agreed with the
 * backend team rather than generated. When the spec gains real response
 * schemas, generate types from it and delete this file.
 *
 * .strict() is deliberate: an unexpected extra field (an attempt counter, an
 * internal id) is a contract change that should fail a test, not pass quietly.
 */

export const UserSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().min(1),
    phoneNumber: z.string(),
    avatar: z.string().min(1),
    username: z.string().min(1),
    role: z.enum(["user", "shop", "superadmin", "sales", "marketing"]),
  })
  .strict();

export const LoginSuccessSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().min(1),
    expiresAt: z.string().min(1),
    user: UserSchema,
  })
  .strict();

export const ErrorSchema = z
  .object({
    // code: z.string().min(1),
    // message: z.string().min(1),
    error: z.string().min(1),
    failedAttempts: z.number().min(1),
  })
  .strict();

export const AccountLockedResponseSchema = z
  .object({
      code: z.enum(["account_locked"]),
      message: z.string().min(1),
      retryAfterSeconds: z.number().min(1),
   })
  .strict();

export type LoginSuccess = z.infer<typeof LoginSuccessSchema>;
export type ApiError = z.infer<typeof ErrorSchema>;

/** Minimal JWT claim set the access token must carry. */
export const AccessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
});

export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;

/** Decodes a JWT payload without verifying the signature (tests are not the verifier). */
export function decodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Access token is not a well-formed JWT");
  const payload = parts[1];
  if (!payload) throw new Error("Access token has an empty payload segment");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}
