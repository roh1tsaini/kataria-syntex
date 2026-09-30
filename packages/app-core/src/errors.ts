import type { ApiCode } from "@kataria-syntex/shared";
import { ApiError } from "./api";

/** Codes this layer generates itself — never emitted by the server. */
type ClientCode = "network_error" | "http_500" | "http_502";

const CLIENT_MESSAGES = {
  network_error:
    "Could not reach the server. Check your connection and try again.",
  http_500: "Something went wrong on our side. Try again in a moment.",
  http_502: "The server is temporarily unavailable. Try again in a moment.",
} satisfies Record<ClientCode, string>;

const SERVER_MESSAGES = {
  invalid_request: "Check the form fields and try again.",
  invalid_identifier: "Enter a valid phone number or email address.",
  unknown_identifier: "No account exists for that yet.",
  not_found: "This record was deleted already.",
  forbidden: "You don't have permission to do this.",
  unauthorized: "Your session expired. Log in again.",
  // auth / otp
  invalid_code: "Wrong code. Try again.",
  invalid_credentials: "Wrong phone, email, or password.",
  otp_expired: "Code expired. Request a new one.",
  otp_attempts_exhausted: "Too many wrong attempts. Request a new code.",
  otp_not_found: "No active code. Request a new one.",
  otp_not_verified: "Verify your code first, then continue.",
  otp_resend_cooldown: "Wait a moment before requesting again.",
  otp_rate_limit_hourly:
    "Too many codes requested for this account. Try later today.",
  otp_rate_limit_daily:
    "Daily code limit reached for this account. Try again tomorrow.",
  otp_budget_exhausted:
    "The service is paused for a while. Please try again later.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  otp_rate_limit_ip: "Too many requests from this device. Try later.",
  otp_send_failed:
    "Couldn't send the code right now. Please try again shortly.",
  password_login_rate_limited: "Too many failed logins. Try in 15 minutes.",
  user_exists:
    "An account already exists for this phone/email. Log in instead.",
  // qr login
  qr_code_invalid: "That code is not valid or was already used.",
  qr_code_expired: "That code has expired. Ask for a new one.",
  qr_already_approved: "This code was already approved.",
  qr_rate_limited:
    "Too many QR codes requested from this network. Wait a moment and try again.",
  internal_server_error:
    "Something went wrong on our side. Try again in a moment.",
  // updates — the blocking update gate handles this code; the entry only
  // satisfies the exhaustive Record for toasts that never special-case it.
  update_required: "This version is no longer supported. Update the app.",
} satisfies Record<ApiCode, string>;

/**
 * Drift check: every server code has a message and every message maps to a
 * live code — adding a code on either side without the other fails
 * typecheck. Codes with no server emitter are deleted here and in ApiCode,
 * never kept just in case.
 */
const MESSAGES = { ...CLIENT_MESSAGES, ...SERVER_MESSAGES } satisfies Record<
  ApiCode | ClientCode,
  string
>;

export function friendlyError(
  err: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  if (err instanceof ApiError) {
    const key = err.code as keyof typeof MESSAGES;
    return MESSAGES[key] ?? fallback;
  }
  // Offline and proxy failures never reach the server — say so directly.
  if (err instanceof TypeError) return MESSAGES.network_error;
  return fallback;
}
