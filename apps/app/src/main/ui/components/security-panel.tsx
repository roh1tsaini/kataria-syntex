import { useEffect, useState } from "react";

import { Button } from "@/ui/components/ui/button";
import { Card } from "@/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";
import { Input } from "@/ui/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/ui/components/ui/input-otp";
import { maskIdentifier } from "@/ui/lib/text";
import {
  ApiError,
  friendlyError,
  toastError,
  toastSuccess,
  useAuth,
} from "@kataria-syntex/app-core";

type Mode = "password" | "code";

/** Settings → Security. Change the password by proving either the current
 *  password or a code sent to the account. One surface for all shells. */
export function SecurityPanel() {
  const user = useAuth((s) => s.user);
  const requestOtp = useAuth((s) => s.requestOtp);
  const changePassword = useAuth((s) => s.changePassword);

  const [mode, setMode] = useState<Mode>("password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const identifier = user ? (user.phone ?? user.email) : null;

  const reset = () => {
    setMode("password");
    setCurrentPassword("");
    setNewPassword("");
    setCode("");
    setCodeSent(false);
    setError(null);
  };

  const sendCode = async () => {
    if (!identifier || cooldown > 0) return;
    setError(null);
    setSending(true);
    try {
      await requestOtp(identifier);
      setCodeSent(true);
      setCooldown(30);
    } catch (err) {
      // A code was requested moments ago on this account (e.g. from a login
      // screen) — mirror the wait locally instead of just failing.
      if (err instanceof ApiError && err.code === "otp_resend_cooldown")
        setCooldown(30);
      toastError("Could not send the code", friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await changePassword(
        mode === "password"
          ? { currentPassword, newPassword }
          : { code, newPassword },
      );
      toastSuccess("Password updated.");
      reset();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  // Every account carries at least one identifier; guard so a broken session
  // can never send a code into nowhere.
  if (!identifier) return null;

  const ready =
    newPassword.length >= 10 &&
    (mode === "password"
      ? currentPassword.length > 0
      : codeSent && code.length === 6);

  const masked = maskIdentifier(identifier);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold">Password</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used to sign in without a code.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4 p-4 sm:p-5">
        <FieldGroup className="gap-4">
          {mode === "password" ? (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="sec-current">Current password</FieldLabel>
              <Input
                id="sec-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                maxLength={200}
                aria-invalid={!!error}
                autoFocus
              />
            </Field>
          ) : codeSent ? (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="sec-code">Verification code</FieldLabel>
              <InputOTP
                id="sec-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={setCode}
                aria-invalid={!!error}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      data-invalid={error ? true : undefined}
                      className={
                        error
                          ? "[data-invalid=true]:border-destructive [data-invalid=true]:text-destructive"
                          : undefined
                      }
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription>
                Sent to {masked}, expires in 5 minutes.
              </FieldDescription>
            </Field>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              We'll send a code to {masked} to confirm the change.
            </p>
          )}

          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="sec-new">New password</FieldLabel>
            <Input
              id="sec-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={10}
              maxLength={200}
              aria-invalid={!!error}
            />
            <FieldDescription>Minimum 10 characters.</FieldDescription>
          </Field>

          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>

        {mode === "password" ? (
          <Button type="submit" disabled={!ready} loading={busy}>
            Change password
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!ready}
              loading={busy}
              className="flex-1"
            >
              Change password
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void sendCode()}
              disabled={cooldown > 0 || sending}
              loading={sending}
              className="flex-1"
            >
              {cooldown > 0
                ? `Resend code in ${cooldown}s`
                : codeSent
                  ? "Resend code"
                  : "Send code"}
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="link"
          disabled={busy || sending}
          onClick={() => {
            setMode(mode === "password" ? "code" : "password");
            setError(null);
          }}
          className="w-full text-muted-foreground underline"
        >
          {mode === "password"
            ? "Forgot the current password? Use a code instead"
            : "Use the current password instead"}
        </Button>
      </form>
    </Card>
  );
}
