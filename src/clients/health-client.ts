import type { APIRequestContext } from "@playwright/test";
import type { ApiResult } from "./auth-client.js";
import { ENDPOINTS } from "../constants.js";

export class HealthClient {
  constructor(private readonly ctx: APIRequestContext) {}

  async get(): Promise<ApiResult> {
    const start = Date.now();
    const res = await this.ctx.get(ENDPOINTS.health);
    const ms = Date.now() - start;

    return {
      status: res.status(),
      headers: res.headers(),
      body: (await res.json().catch(() => ({}))) as unknown,
      ms,
    };
  }
}
