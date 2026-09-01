/**
 * Auth endpoints — thin composer over four focused routers. Shared infra
 * (cookies, device meta, IP budgets, session payloads) lives in auth-shared.
 */
import { Hono } from "hono";
import { authOtpRoute } from "./auth-otp";
import { authPasswordRoute } from "./auth-password";
import { authSessionRoute } from "./auth-session";
import { authQrRoute } from "./auth-qr";
import type { AuthEnv } from "./auth-shared";

export const authRoute = new Hono<AuthEnv>()
  .route("/", authOtpRoute)
  .route("/", authPasswordRoute)
  .route("/", authSessionRoute)
  .route("/", authQrRoute);
