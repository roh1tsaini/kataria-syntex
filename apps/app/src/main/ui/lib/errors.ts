import type { ApiCode } from "@kataria-syntex/shared";
import { ApiError } from "@/lib/api";

/** Codes this layer generates itself — never emitted by the server. */
type ClientCode =
  "network_error" | "pending_sync_edit" | "http_500" | "http_502";

const CLIENT_MESSAGES = {
  network_error:
    "Could not reach the server. Check your connection and try again.",
  pending_sync_edit:
    "This challan is still waiting to sync. Edit it after it reaches the server.",
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
  no_workspace: "You're not part of a workspace yet.",
  invalid_permissions: "Your access changed. Re-open this page.",
  phone_already_registered: "This phone/email is already part of a workspace.",
  already_pending: "That person is already waiting to join a workspace.",
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
  invite_invalid:
    "This pre-add was already claimed. Log in with your phone/email instead.",
  workspace_name_required: "Enter a company name to create your own workspace.",
  // members
  cannot_change_primary_admin: "The primary admin cannot be demoted.",
  cannot_remove_primary_admin: "The primary admin cannot be removed.",
  // challans
  type_change_not_allowed:
    "A challan's type can't be changed after it's created.",
  fy_change_not_allowed:
    "The date can't move a challan into a different financial year.",
  fy_mismatch:
    "This date now falls in a different financial year — re-open and re-save.",
  invalid_denier: "Choose a valid denier for every row.",
  invalid_color: "Choose a valid colour for every row.",
  invalid_customer: "Choose a valid customer.",
  invalid_job_worker: "Choose a valid job worker.",
  invalid_supplier: "Choose a valid supplier.",
  invalid_challan: "Choose a valid challan for every row.",
  color_not_raw: "Only raw-material colours can be used here.",
  challan_number_conflict:
    "Couldn't reserve a challan number. Try saving again.",
  challan_has_returns:
    "This challan has job-work returns recorded against it. Delete those returns first.",
  challan_job_worker_mismatch:
    "This challan belongs to a different job worker.",
  challan_not_outward: "Returns need a job-work challan.",
  in_use: "This entry is still referenced. Remove those uses first.",
  // recipes
  recipe_exists: "This colour already has a recipe for that denier.",
  recipe_version_missing: "That version no longer exists.",
  recipe_version_conflict:
    "This recipe changed while you were saving. Re-open and try again.",
  // pdf
  pdf_not_configured:
    "PDF service isn't set up on the server yet. Ask the admin to configure it.",
  pdf_render_failed:
    "Couldn't generate the PDF right now. Please try again shortly.",
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
