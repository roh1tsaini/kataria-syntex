/**
 * Bindings available on every request (Worker `env`).
 * Secrets (PINGRAM_API_KEY) arrive via .dev.vars locally and
 * `wrangler secret put` in production — never through wrangler.jsonc.
 */
export type Env = {
  DB: D1Database;
  /** Static assets of this Worker deployment (Inter TTFs for the PDF renderer). */
  ASSETS: Fetcher;
  /** Comma-separated extra CORS origins (website). Optional. */
  CORS_ORIGIN?: string;
  /** Only "development" exposes error detail in responses. */
  APP_ENV?: string;
  PINGRAM_API_KEY?: string;
  PINGRAM_FROM?: string;
  PINGRAM_BASE_URL?: string;
  OTP_DAILY_BUDGET?: string;
  /** "1" = trust the RIGHTMOST X-Forwarded-For entry (one known proxy). */
  TRUST_PROXY?: string;
};
