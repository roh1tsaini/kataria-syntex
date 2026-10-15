import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { AlertCircle, RefreshCw } from "lucide-react-native";
import {
  friendlyError,
  type QrLoginCode,
  useAuth,
} from "@kataria-syntex/app-core";

import { Button, ButtonText } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

const POLL_INTERVAL_MS = 3000;

export function QrLoginPanel({
  identifier,
  onSuccess,
}: {
  identifier?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const startQrLogin = useAuth((s) => s.startQrLogin);
  const pollQrLogin = useAuth((s) => s.pollQrLogin);
  const authed = useAuth((s) => s.status === "authed");

  const [pairing, setPairing] = useState<QrLoginCode | null>(null);
  const [polling, setPolling] = useState<
    "pending" | "expired" | "not_found" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);

  const identRef = useRef(identifier);
  identRef.current = identifier;

  useEffect(() => {
    if (authed) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace("/");
      }
    }
  }, [authed, onSuccess, router]);

  // Countdown timer
  useEffect(() => {
    if (!pairing?.expiresAt) return;
    const expiresMs = new Date(pairing.expiresAt).getTime();

    const updateTimer = () => {
      const left = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsLeft(left);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pairing?.expiresAt]);

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
    if (!pairing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void tick();
      }, POLL_INTERVAL_MS);
    };

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() >= new Date(pairing.expiresAt).getTime()) {
        setPolling("expired");
        return;
      }
      try {
        const status = await pollQrLogin(pairing.code, pairing.claimSecret);
        if (cancelled) return;
        if (status === "ok") {
          return;
        }
        if (status === "pending") {
          schedule();
        } else {
          setPolling(status);
        }
      } catch {
        schedule();
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <View className="w-full flex-col items-center gap-4">
      <Text className="max-w-[260px] text-center text-xs leading-5 text-muted-foreground">
        {error
          ? "No connection. Try again."
          : expired
            ? "Code expired. Refresh for a new one."
            : polling === "not_found" || polling === "expired"
              ? "Code no longer valid. Refresh."
              : "Scan with a signed-in device."}
      </Text>

      {/* QR frame */}
      <View className="size-48 items-center justify-center rounded-lg border border-border bg-white p-2">
        {error ? (
          <View className="size-full items-center justify-center gap-2 p-2 text-center">
            <AlertCircle size={20} className="text-destructive" />
            <Text className="text-center text-xs text-destructive">
              {error}
            </Text>
            <Button variant="outline" onPress={refresh} disabled={refreshing}>
              <RefreshCw size={14} />
              <ButtonText variant="outline">Try again</ButtonText>
            </Button>
          </View>
        ) : pairing ? (
          <View className="items-center justify-center">
            <QRCode
              value={pairing.payload}
              size={160}
              backgroundColor="white"
              color="#000000"
            />
            {expired ? (
              <View className="absolute inset-0 items-center justify-center gap-2 rounded-lg bg-card/95 p-4">
                <Text className="font-semibold text-xs text-foreground">
                  QR code expired
                </Text>
                <Button
                  variant="outline"
                  onPress={refresh}
                  loading={refreshing}
                >
                  <RefreshCw size={14} />
                  <ButtonText variant="outline">Refresh</ButtonText>
                </Button>
              </View>
            ) : null}
          </View>
        ) : (
          <Skeleton className="size-full rounded-sm" />
        )}
      </View>

      {/* Pairing code & countdown */}
      {!error && (
        <View className="items-center gap-1">
          {pairing ? (
            <View className="rounded-md border border-border bg-muted/70 px-3.5 py-1.5">
              <Text className="font-mono font-bold text-[15px] tracking-widest text-primary">
                {pairing.code}
              </Text>
            </View>
          ) : (
            <Skeleton className="h-9 w-40 rounded-md" />
          )}

          <Text className="text-xs text-muted-foreground">
            {expired
              ? "Code expired"
              : secondsLeft > 0
                ? `Expires in ${minutes}:${String(seconds).padStart(2, "0")}`
                : "Loading pairing..."}
          </Text>
        </View>
      )}
    </View>
  );
}
