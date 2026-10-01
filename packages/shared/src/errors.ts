/**
 * Every machine-readable error code the API can emit in `{ error: "code" }`
 * bodies. Single source of truth: the server's `apiError()` helper and the
 * client's message map are both typed against this union, so adding a code
 * on one side without the other fails typecheck.
 */
const API_CODES = [
  // generic
  "invalid_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "internal_server_error",
  // auth / identity
  "invalid_identifier",
  "unknown_identifier",
  "invalid_credentials",
  "invalid_code",
  "user_exists",
  // otp
  "otp_expired",
  "otp_attempts_exhausted",
  "otp_not_found",
  "otp_not_verified",
  "otp_resend_cooldown",
  "otp_rate_limit_hourly",
  "otp_rate_limit_daily",
  "otp_rate_limit_ip",
  "otp_budget_exhausted",
  "otp_send_failed",
  "password_login_rate_limited",
  // qr login
  "qr_code_invalid",
  "qr_code_expired",
  "qr_already_approved",
  "qr_rate_limited",
  // updates — the API carries no backward compatibility; a client below the
  // released minAppVersion gets this on every call (see AGENTS.md Section 4.0.1)
  "update_required",
] as const;

export type ApiCode = (typeof API_CODES)[number];
