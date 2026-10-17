import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api, useAuth, friendlyError } from "@kataria-syntex/app-core";
import { Button } from "@/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/ui/components/ui/field";
import { SuffixInput } from "@/ui/components/suffix-input";
import { Skeleton } from "@/ui/components/motion";
import { EASE_OUT } from "@/ui/lib/motion";

type QrInfo = {
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
  deviceLabel: string | null;
};

/**
 * Approve page opened by scanning the login QR from any camera device.
 * Requires a session on THIS device; grants the waiting device either the
 * named account or your own. Approval needs the last 4 characters of the
 * code shown on the waiting device, so a forwarded link cannot approve.
 */
export function ScanApprovePage() {
  const reduceMotion = useReducedMotion();
  const { id = "" } = useParams();
  const status = useAuth((s) => s.status);
  const approveQrLoginBySuffix = useAuth((s) => s.approveQrLoginBySuffix);
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvedAs, setApprovedAs] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suffix, setSuffix] = useState("");

  useEffect(() => {
    if (status !== "authed" || !id) return;
    let cancelled = false;
    api<QrInfo>(`/auth/qr/info?id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!cancelled) setInfo(res);
      })
      .catch((err) => {
        if (!cancelled) setInfoError(friendlyError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [status, id]);

  if (!id || status === "guest")
    return (
      <Navigate
        to={`/auth?next=${encodeURIComponent(`/login/scan/${id}`)}`}
        replace
      />
    );

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Skeleton className="h-64 w-full max-w-sm rounded-lg" />
      </div>
    );
  }

  const ready = suffix.length === 4;

  const approve = async () => {
    setSubmitError(null);
    setBusy(true);
    try {
      const res = await approveQrLoginBySuffix(id, suffix);
      setApprovedAs(
        res.grantedSelf ? "you" : (res.grantedName ?? "the account"),
      );
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const expiredOrUsed =
    info && (info.status === "expired" || info.status === "not_found");
  const alreadyApproved = info?.status === "approved";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.2 : 0.24, ease: EASE_OUT }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <div className="content-icon-tile bg-accent text-accent-foreground">
              {approvedAs ? (
                <CheckCircle2 className="size-5" aria-hidden />
              ) : (
                <ShieldCheck className="size-5" aria-hidden />
              )}
            </div>
            <CardTitle className="mt-3">
              {approvedAs
                ? "Approved"
                : expiredOrUsed
                  ? "Code no longer valid"
                  : alreadyApproved
                    ? "Already approved"
                    : "Approve this login?"}
            </CardTitle>
            <CardDescription>
              {approvedAs ? (
                <>
                  {info?.deviceLabel || "That device"} is now signed in as{" "}
                  <span className="font-medium text-foreground">
                    {approvedAs}
                  </span>
                  .
                </>
              ) : expiredOrUsed ? (
                "Ask the other device to show a fresh QR code."
              ) : alreadyApproved ? (
                "This code was already approved."
              ) : (
                "Check the device, then type the code from its screen."
              )}
            </CardDescription>
          </CardHeader>
          {!approvedAs && !expiredOrUsed && !alreadyApproved && (
            <CardContent className="flex flex-col gap-3">
              {infoError && (
                <p role="alert" className="text-sm text-destructive">
                  {infoError}
                </p>
              )}
              {/* Name the requesting device, not just the account. A prompt
                  that only reads "log in as <you>" looks identical whether the
                  QR came from your own second device or from a stranger's
                  link. The label is the requester's own claim, taken off an
                  unauthenticated header — so the row says "Claims to be".
                  "Signs in as" is server-derived; the typed suffix beneath the
                  block is the proof that this person can see the waiting
                  device's screen. */}
              <dl className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Claims to be</dt>
                  <dd className="truncate font-medium text-foreground">
                    {info?.deviceLabel || "unknown device"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Signs in as</dt>
                  <dd className="truncate font-medium text-foreground">
                    {info?.targetName || "you"}
                  </dd>
                </div>
              </dl>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ready && !busy) void approve();
                }}
              >
                <Field>
                  <FieldLabel htmlFor="code-suffix">Code ends in</FieldLabel>
                  <SuffixInput
                    id="code-suffix"
                    value={suffix}
                    onChange={setSuffix}
                    error={submitError}
                    describedBy="code-suffix-error"
                  />
                  <FieldDescription>
                    The last 4 characters of the code shown on the other device.
                  </FieldDescription>
                </Field>
                {submitError && (
                  <FieldError id="code-suffix-error">{submitError}</FieldError>
                )}
                <Button
                  type="submit"
                  disabled={!ready}
                  loading={busy}
                  className="w-full"
                >
                  Approve login
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
