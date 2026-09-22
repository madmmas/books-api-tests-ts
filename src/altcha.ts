import { createHash } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { config } from "./config.js";

/**
 * ALTCHA proof-of-work helper.
 *
 * The widget fetches a challenge, finds the number whose hash matches, and
 * submits a base64 payload. Tests do the same thing headlessly.
 *
 * NOTE: the challenge path is not in the published OpenAPI spec. It is set via
 * ALTCHA_CHALLENGE_PATH and must be confirmed with the backend team.
 */

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber?: number;
}

const HASH_ALGORITHMS: Record<string, string> = {
  "SHA-1": "sha1",
  "SHA-256": "sha256",
  "SHA-512": "sha512",
};

export async function fetchChallenge(ctx: APIRequestContext): Promise<AltchaChallenge> {
  const res = await ctx.get(config.altchaChallengePath);
  if (!res.ok()) {
    throw new Error(
      `Could not fetch an ALTCHA challenge from ${config.altchaChallengePath} ` +
        `(status ${res.status()}). Check ALTCHA_CHALLENGE_PATH.`,
    );
  }
  return (await res.json()) as AltchaChallenge;
}

/** Finds the number n where hash(salt + n) equals the challenge. */
export function solveChallenge(challenge: AltchaChallenge): number {
  const algorithm = HASH_ALGORITHMS[challenge.algorithm];
  if (!algorithm) {
    throw new Error(`Unsupported ALTCHA algorithm: ${challenge.algorithm}`);
  }

  const max = challenge.maxnumber ?? 1_000_000;
  for (let n = 0; n <= max; n++) {
    const digest = createHash(algorithm).update(`${challenge.salt}${n}`).digest("hex");
    if (digest === challenge.challenge) return n;
  }

  throw new Error(`No ALTCHA solution found below maxnumber=${max}`);
}

/** Encodes a solved challenge the way the ALTCHA widget does. */
export function encodeSolution(challenge: AltchaChallenge, number: number): string {
  const payload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    number,
    salt: challenge.salt,
    signature: challenge.signature,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Fetches and solves a challenge in one call.
 * Belongs in the Arrange phase: solve first, then act.
 */
export async function solveCaptcha(ctx: APIRequestContext): Promise<string> {
  const challenge = await fetchChallenge(ctx);
  return encodeSolution(challenge, solveChallenge(challenge));
}
