import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useAuth, type QrLoginCode } from "@/store/auth";
import { friendlyError } from "@/ui/lib/errors";
import { useCountdown } from "@/ui/hooks/use-countdown";
import { Button } from "@/ui/components/ui/button";
import { Skeleton } from "@/ui/components/motion";

const POLL_INTERVAL_MS = 3000;

export function QrLoginPanel({ identifier }: { identifier?: string }) {
  const startQrLogin = useAuth((s) => s.startQrLogin);
  const pollQrLogin = useAuth((s) => s.pollQrLogin);
  const authed = useAuth((s) => s.status === "authed");
  const navigate = useNavigate();
  const [pairing, setPairing] = useState<QrLoginCode | null>(null);
  const [polling, setPolling] = useState<
    "pending" | "expired" | "not_found" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { mm, ss } = useCountdown(pairing?.expiresAt ?? null);
  const secondsLeft = mm * 60 + ss;
  const identRef = useRef(identifier);
  identRef.current = identifier;

  useEffect(() => {
    if (authed) navigate("/", { replace: true });
  }, [authed, navigate]);

  const start = useCallback(async () => {
    setError(null);
    setPolling(null);
    setPairing(null);
    try {
      const res = await startQrLogin(identRef.current || undefined);
      setPairing(res);
    } catch (err) {
      setError(friendlyError(err, "Could not start QR login. Try again."));
    }
  }, [startQrLogin]);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    if (!pairing || secondsLeft <= 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled) return;
      // Stop once the code has really lapsed — don't keep polling a code the
      // UI already shows as expired.
      if (Date.now() >= new Date(pairing.expiresAt).getTime()) {
        setPolling("expired");
        if (timer) clearInterval(timer);
        return;
      }
      try {
        const status = await pollQrLogin(pairing.code);
        if (cancelled) return;
        if (status === "ok") return;
        if (status !== "pending") {
          setPolling(status);
          if (timer) clearInterval(timer);
        }
      } catch {
        // transient network error — keep polling
      }
    };

    void tick();
    timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pairing, pollQrLogin]);

  const expired = pairing !== null && secondsLeft <= 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await start();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* QR frame — card radius; the SVG paints its own white canvas so scans
          keep full contrast in dark mode too. */}
      <div className="relative flex size-48 items-center justify-center rounded-lg border border-border bg-card p-3">
        {error ? (
          <div className="flex size-full flex-col items-center justify-center gap-2.5 p-2 text-center">
            <AlertCircle className="size-5 text-destructive" aria-hidden />
            <p className="line-clamp-3 text-xs leading-tight text-destructive">
              {error}
            </p>
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw className="size-4" aria-hidden />
              Try again
            </Button>
          </div>
        ) : pairing ? (
          <>
            <QRCodeSVG
              value={pairing.payload}
              size={168}
              marginSize={0}
              className="size-full rounded-sm"
              style={{ width: "100%", height: "100%" }}
            />
            {expired && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-lg bg-card/95 p-4 text-center">
                <p className="text-xs font-semibold text-foreground">
                  QR code expired
                </p>
                <Button
                  variant="outline"
                  onClick={() => void refresh()}
                  loading={refreshing}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Refresh
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <Skeleton className="size-full rounded-sm" />
          </div>
        )}
      </div>

      {/* Alphanumeric Pairing Code & Countdown */}
      {!error && (
        <div className="flex flex-col items-center gap-1">
          {pairing ? (
            <code className="rounded-sm border border-border bg-muted/70 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-primary">
              {pairing.code}
            </code>
          ) : (
            <Skeleton className="h-6 w-24 rounded-sm" />
          )}

          <p
            role="status"
            aria-live="polite"
            aria-label={
              expired
                ? "Code expired"
                : `Code expires in ${mm} minutes ${ss} seconds`
            }
            className="text-[11px] tabular-nums text-muted-foreground"
          >
            {expired
              ? "Code expired"
              : secondsLeft > 0
                ? `Expires in ${mm}:${String(ss).padStart(2, "0")}`
                : "Loading pairing…"}
          </p>
        </div>
      )}

      {/* Subtext */}
      <p className="max-w-[260px] text-center text-xs leading-relaxed text-muted-foreground">
        {error
          ? "Request a fresh QR code once connectivity is restored."
          : expired
            ? "Refresh the code to continue."
            : polling === "not_found" || polling === "expired"
              ? "This code is no longer valid. Refresh to get a new one."
              : "Scan with any logged-in device to sign into this device instantly."}
      </p>
    </div>
  );
}
