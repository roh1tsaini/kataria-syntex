/**
 * Bindings available on every request (Worker `env`).
 * Secrets (PINGRAM_API_KEY) arrive via .dev.vars locally and
 * `wrangler secret put` in production — never through wrangler.jsonc.
 */
export type Env = {
  DB: D1Database;
  /** Static assets of this Worker deployment. */
  ASSETS: Fetcher;
  /** Release bucket — installers, APK and update manifests (see /releases). */
  RELEASES: R2Bucket;
  PINGRAM_API_KEY?: string;
  TELEGRAM_ADMIN_ID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  OTP_DAILY_BUDGET?: string;
};
