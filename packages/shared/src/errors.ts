/**
 * Every machine-readable error code the API can emit in `{ error: "code" }`
 * bodies. Single source of truth: the server's `apiError()` helper and the
 * client's message map are both typed against this union, so adding a code
 * on one side without the other fails typecheck.
 */
const API_CODES = [
  // generic
  "invalid_request",
  "invalid_permissions",
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
  "phone_already_registered",
  "invite_invalid",
  "workspace_name_required",
  "no_workspace",
  "company_not_found",
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
  // members
  "already_pending",
  "cannot_change_primary_admin",
  "cannot_remove_primary_admin",
  // challans
  "invalid_challan",
  "invalid_denier",
  "invalid_color",
  "invalid_customer",
  "invalid_job_worker",
  "invalid_supplier",
  "color_not_raw",
  "challan_number_conflict",
  "challan_has_returns",
  "challan_job_worker_mismatch",
  "challan_not_outward",
  "type_change_not_allowed",
  "fy_change_not_allowed",
  "fy_mismatch",
  "financial_year_missing",
  "entry_locked",
  "in_use",
  "stock_consumed",
  // recipes
  "recipe_exists",
  "recipe_version_missing",
  "recipe_version_conflict",
  // pdf
  "pdf_not_configured",
  "pdf_render_failed",
  // qr login
  "qr_code_invalid",
  "qr_code_expired",
  "qr_already_approved",
  "qr_rate_limited",
] as const;

export type ApiCode = (typeof API_CODES)[number];
