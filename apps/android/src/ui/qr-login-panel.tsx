/**
 * QR login panel — scan this code with a signed-in device to pair this one.
 * Same contract as the web panel: start → poll every 3s → ok/expired/
 * not_found; countdown to expiry; refresh regenerates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";
import {
  useAuth,
  friendlyError,
  type QrLoginCode,
} from "@kataria-syntex/app-core";
import { usePalette, withAlpha } from "@/theme";
import { Button, Skeleton } from "@/ui/kit";

const POLL_INTERVAL_MS = 3000;

function useCountdownParts(expiresAt: string | null): {
  mm: number;
  ss: number;
  total: number;
} {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return { mm: 0, ss: 0, total: 0 };
  const total = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now) / 1000),
  );
  return { mm: Math.floor(total / 60), ss: total % 60, total };
}

export function QrLoginPanel({ identifier }: { identifier?: string }) {
  const startQrLogin = useAuth((s) => s.startQrLogin);
  const pollQrLogin = useAuth((s) => s.pollQrLogin);
  const authed = useAuth((s) => s.status === "authed");
  const router = useRouter();
  const [pairing, setPairing] = useState<QrLoginCode | null>(null);
  const [polling, setPolling] = useState<
    "pending" | "expired" | "not_found" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const startSeq = useRef(0);
  const { mm, ss, total } = useCountdownParts(pairing?.expiresAt ?? null);
  const p = usePalette();

  const start = useCallback(async () => {
    const seq = ++startSeq.current;
    setError(null);
    setPolling(null);
    setPairing(null);
    try {
      const res = await startQrLogin(identifier || undefined);
      if (seq !== startSeq.current) return;
      setPairing(res);
    } catch (err) {
      if (seq !== startSeq.current) return;
      setError(friendlyError(err, "Could not start QR login. Try again."));
    }
  }, [startQrLogin, identifier]);

  useEffect(() => {
    void start();
  }, [start, identifier]);

  // Approval flips the session on the store — leave the QR screen the same
  // way OTP login does (web's panel navigates identically).
  useEffect(() => {
    if (authed) router.replace("/");
  }, [authed, router]);

  useEffect(() => {
    if (!pairing) return;
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled || inFlight) return;
      if (Date.now() >= new Date(pairing.expiresAt).getTime()) {
        setPolling("expired");
        if (timer) clearInterval(timer);
        return;
      }
      inFlight = true;
      try {
        const status = await pollQrLogin(pairing.code);
        if (cancelled) return;
        if (status === "ok") {
          if (timer) clearInterval(timer);
          return;
        }
        if (status !== "pending") {
          setPolling(status);
          if (timer) clearInterval(timer);
        }
      } catch {
        // transient network error — keep polling
      } finally {
        inFlight = false;
      }
    };

    void tick();
    timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pairing, pollQrLogin]);

  const expired = pairing !== null && total <= 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await start();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="w-full items-center gap-4">
      <Text
        className="max-w-[260px] text-center text-xs"
        style={{ color: p.mutedForeground }}
      >
        {error
          ? "No connection. Try again."
          : expired
            ? "Code expired. Refresh for a new one."
            : polling === "not_found" || polling === "expired"
              ? "Code no longer valid. Refresh."
              : "Scan with a signed-in device."}
      </Text>
      <View
        className="h-48 w-48 items-center justify-center rounded-lg border p-2"
        /* The QR quiet zone must stay pure white on both schemes or cameras
           lose the finder patterns — the one deliberate raw color in the app. */
        style={{ backgroundColor: "#ffffff", borderColor: p.border }}
      >
        {error ? (
          <View className="h-full w-full items-center justify-center gap-2.5 p-2">
            <Text
              className="text-center text-xs"
              style={{ color: p.destructive }}
            >
              {error}
            </Text>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => void refresh()}
              disabled={refreshing}
            />
          </View>
        ) : pairing ? (
          <>
            <QRCode
              value={pairing.payload}
              size={168}
              color="#0a0a0a"
              backgroundColor="transparent"
            />
            {expired && (
              <View
                className="absolute inset-0 items-center justify-center gap-2 rounded-lg p-4"
                style={{ backgroundColor: withAlpha(p.card, 0.95) }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: p.foreground }}
                >
                  QR code expired
                </Text>
                <Button
                  label="Refresh"
                  variant="secondary"
                  onPress={() => void refresh()}
                  loading={refreshing}
                />
              </View>
            )}
          </>
        ) : (
          <Skeleton className="h-40 w-40 rounded-md" />
        )}
      </View>
      {!error && (
        <View className="items-center gap-1">
          {pairing ? (
            <View
              className="rounded-md border px-3.5 py-1.5"
              style={{ backgroundColor: p.muted, borderColor: p.border }}
            >
              <Text
                className="text-[15px] font-bold"
                style={{ color: p.primary, letterSpacing: 3 }}
              >
                {pairing.code}
              </Text>
            </View>
          ) : null}
          <Text className="text-[13px]" style={{ color: p.mutedForeground }}>
            {expired
              ? "Code expired"
              : total > 0
                ? `Expires in ${mm}:${String(ss).padStart(2, "0")}`
                : "Loading pairing…"}
          </Text>
        </View>
      )}
    </View>
  );
}
