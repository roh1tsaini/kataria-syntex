import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { friendlyError } from "@/ui/lib/errors";
import { Button } from "@/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/ui/card";
import { Skeleton } from "@/ui/components/motion";
import { EASE } from "@/ui/lib/motion";

type QrInfo = {
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
};

/**
 * Approve page opened by scanning the login QR from any camera device.
 * Requires a session on THIS device; grants the waiting device either the
 * named account (admin fallback) or your own.
 */
export function ScanApprovePage() {
  const reduceMotion = useReducedMotion();
  const { code = "" } = useParams();
  const status = useAuth((s) => s.status);
  const approveQrLogin = useAuth((s) => s.approveQrLogin);
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvedAs, setApprovedAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authed" || !code) return;
    let cancelled = false;
    api<QrInfo>(`/auth/qr/info?code=${encodeURIComponent(code)}`)
      .then((res) => {
        if (!cancelled) setInfo(res);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [status, code]);

  if (!code || status === "guest") return <Navigate to="/auth" replace />;

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] items-center justify-center p-6">
        <Skeleton className="h-64 w-full max-w-sm rounded-lg" />
      </div>
    );
  }

  const approve = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await approveQrLogin(code);
      setApprovedAs(
        res.grantedSelf ? "you" : (res.grantedName ?? "the account"),
      );
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const expiredOrUsed =
    info && (info.status === "expired" || info.status === "not_found");
  const alreadyApproved = info?.status === "approved";

  return (
    <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.2 : 0.24, ease: EASE }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
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
                  The other device is now logged in as{" "}
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
                "You scanned a login QR from another device."
              )}
            </CardDescription>
          </CardHeader>
          {!approvedAs && !expiredOrUsed && !alreadyApproved && (
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {info?.targetName ? (
                  <>
                    This will log that device in as{" "}
                    <span className="font-semibold text-foreground">
                      {info.targetName}
                    </span>
                    .
                  </>
                ) : (
                  "This will log that device in as you."
                )}
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={() => void approve()}
                disabled={busy}
                loading={busy}
                className="w-full"
              >
                Approve login
              </Button>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
