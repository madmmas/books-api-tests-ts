import { readFileSync } from "node:fs";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import yaml from "js-yaml";
import { config } from "../config.js";

/**
 * Contract checks against the team's OpenAPI document.
 *
 * The spec is the source of truth. Where it is incomplete (see README,
 * "Known spec gaps"), the gap is reported by a test rather than worked around
 * here, so it stays visible until the spec is fixed.
 */

interface OpenApiDocument {
  components?: { schemas?: Record<string, unknown> };
  paths?: Record<string, Record<string, OperationObject>>;
}

interface OperationObject {
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<string, unknown>;
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const spec = yaml.load(readFileSync(config.openApiSpecPath, "utf8")) as OpenApiDocument;

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validatorCache = new Map<string, ValidateFunction>();

function operation(path: string, method: HttpMethod): OperationObject {
  const op = spec.paths?.[path]?.[method];
  if (!op) {
    throw new Error(
      `${method.toUpperCase()} ${path} is not documented in ${config.openApiSpecPath}`,
    );
  }
  return op;
}

/** Status codes the spec documents for an operation, as numbers. */
export function documentedStatuses(path: string, method: HttpMethod): number[] {
  return Object.keys(operation(path, method).responses ?? {})
    .map((code) => Number(code))
    .filter((code) => Number.isInteger(code))
    .sort((a, b) => a - b);
}

/** True when the spec documents this status for the operation. */
export function isStatusDocumented(path: string, method: HttpMethod, status: number): boolean {
  return documentedStatuses(path, method).includes(status);
}

/**
 * Validates a request body against the operation's requestBody schema.
 * Returns human-readable errors, or an empty array when valid.
 */
export function validateRequestBody(path: string, method: HttpMethod, body: unknown): string[] {
  const schema = operation(path, method).requestBody?.content?.["application/json"]?.schema;
  if (!schema) {
    throw new Error(`${method.toUpperCase()} ${path} documents no JSON request body`);
  }

  // `#/components/schemas/...` resolves against the ROOT of the schema being
  // compiled, so the components block travels with it. Compiled validators are
  // cached: ajv compilation is not cheap and the schema never changes.
  const cacheKey = `${method} ${path}`;
  let validate = validatorCache.get(cacheKey);
  if (!validate) {
    validate = ajv.compile({
      ...(schema as Record<string, unknown>),
      components: spec.components,
    });
    validatorCache.set(cacheKey, validate);
  }

  if (validate(body)) return [];

  return (validate.errors ?? []).map(
    (err) => `${err.instancePath || "(root)"} ${err.message ?? "is invalid"}`,
  );
}

/** Raw spec access, for tests that assert on the document itself. */
export function specDocument(): OpenApiDocument {
  return spec;
}

export function specPaths(): string[] {
  return Object.keys(spec.paths ?? {});
}
