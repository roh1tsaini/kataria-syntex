import type { ApiCode } from "@kataria-syntex/shared";

/** Minimal structural type so every Hono env variant can use the helper. */
interface JsonEmitter {
  json(
    data: unknown,
    status?: 400 | 401 | 403 | 404 | 409 | 426 | 429 | 500 | 502,
  ): Response;
}

/**
 * The only way a route may emit an error body. Codes are confined to the
 * shared ApiCode union, so inventing a code server-side without a client
 * mapping (or vice versa) fails typecheck instead of reaching users as a
 * raw snake_case string.
 */
export function apiError(
  c: JsonEmitter,
  code: ApiCode,
  status: 400 | 401 | 403 | 404 | 409 | 426 | 429 | 500 | 502 = 400,
  extra?: Record<string, unknown>,
) {
  return c.json({ error: code, ...extra }, status);
}
