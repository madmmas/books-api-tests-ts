import type { APIRequestContext } from "@playwright/test";
import { solveCaptcha } from "../altcha.js";
import { ENDPOINTS } from "../constants.js";

/**
 * Thin HTTP client for the auth endpoints.
 *
 * Rules this client follows:
 *  - it returns results, it never asserts (tests own assertions);
 *  - it holds no state between calls, so it is safe under parallel workers;
 *  - the captcha is solved BEFORE the timer starts, so `ms` measures only the
 *    login request.
 */

export interface ApiResult<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
  /** Round-trip time of the request itself, captcha solving excluded. */
  ms: number;
}

export interface LoginOptions {
  /** false sends no altcha field at all. Default: solve and send one. */
  captcha?: boolean;
  /** Use this exact altcha value instead of solving a fresh challenge. */
  altcha?: string;
}

export class AuthClient {
  constructor(private readonly ctx: APIRequestContext) {}

  /** POSTs a fully-formed login request. */
  async login(username: string, password: string, options: LoginOptions = {}): Promise<ApiResult> {
    const data: Record<string, unknown> = { username, password };

    if (options.altcha !== undefined) {
      data.altcha = options.altcha;
    } else if (options.captcha !== false) {
      data.altcha = await solveCaptcha(this.ctx);
    }

    return this.postLogin(data);
  }

  /**
   * POSTs an arbitrary body, for validation cases that must omit or malform
   * fields (missing username, empty password, wrong types).
   */
  async postLogin(data: Record<string, unknown>): Promise<ApiResult> {
    const start = Date.now();
    const res = await this.ctx.post(ENDPOINTS.jwtLogin, { data });
    const ms = Date.now() - start;

    return {
      status: res.status(),
      headers: res.headers(),
      body: (await res.json().catch(() => ({}))) as unknown,
      ms,
    };
  }

  /** Solves a captcha without sending it, for replay and reuse cases. */
  async freshCaptcha(): Promise<string> {
    return solveCaptcha(this.ctx);
  }
}
