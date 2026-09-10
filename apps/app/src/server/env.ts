/**
 * Bindings available on every request (Worker `env`).
 * Secrets (PINGRAM_API_KEY) arrive via .dev.vars locally and
 * `wrangler secret put` in production — never through wrangler.jsonc.
 */
export type Env = {
  DB: D1Database;
  /** Static assets of this Worker deployment (Inter TTFs for the PDF renderer). */
  ASSETS: Fetcher;
  /** Release bucket — installers, APK and update manifests (see /releases). */
  RELEASES: R2Bucket;
  /** Realtime rooms — one Durable Object per workspace (see realtime/room.ts). */
  REALTIME: DurableObjectNamespace;
  /** Comma-separated extra CORS origins (website). Optional. */
  CORS_ORIGIN?: string;
  /** Only "development" exposes error detail in responses. */
  APP_ENV?: string;
  PINGRAM_API_KEY?: string;
  OTP_DAILY_BUDGET?: string;
  /** Browser Run renderer: account id + API token (Browser Rendering "Edit"). */
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  /** "1" = trust the RIGHTMOST X-Forwarded-For entry (one known proxy). */
  TRUST_PROXY?: string;
};
