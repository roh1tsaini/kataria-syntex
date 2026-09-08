/**
 * Scan-approve — the Android port of apps/app's ScanApprovePage. Opens via
 * the QR payload link (kataria://login/scan/<code>) or by scanning a login
 * QR from another device; requires a session here and grants the waiting
 * device the named account or your own.
 */

import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, useAuth, friendlyError } from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Button, Card } from "@/ui/kit";

type QrInfo = {
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
};

export default function ScanApproveRoute() {
  const { code = "" } = useLocalSearchParams<{ code?: string }>();
  const status = useAuth((s) => s.status);
  const approveQrLogin = useAuth((s) => s.approveQrLogin);
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvedAs, setApprovedAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const p = usePalette();

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

  useEffect(() => {
    if (status === "guest") router.replace("/auth");
  }, [status, router]);

  if (status === "loading") return null;

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

  const title = approvedAs
    ? "Approved"
    : expiredOrUsed
      ? "Code no longer valid"
      : alreadyApproved
        ? "Already approved"
        : "Approve this login?";

  const body = approvedAs
    ? `The other device is now logged in as ${approvedAs}.`
    : expiredOrUsed
      ? "Ask the other device to show a fresh QR code."
      : alreadyApproved
        ? "This code was already approved."
        : "You scanned a login QR from another device.";

  return (
    <View
      className="flex-1 items-center justify-center p-4"
      style={{ backgroundColor: p.background }}
    >
      <Card className="w-full max-w-sm">
        <View className="gap-3">
          <Text
            className="text-[17px] font-semibold"
            style={{ color: p.foreground }}
          >
            {title}
          </Text>
          <Text className="text-[13px]" style={{ color: p.mutedForeground }}>
            {body}
          </Text>
          {!approvedAs && !expiredOrUsed && !alreadyApproved && (
            <>
              <Text
                className="text-[13px]"
                style={{ color: p.mutedForeground }}
              >
                {info?.targetName
                  ? `This will log that device in as ${info.targetName}.`
                  : "This will log that device in as you."}
              </Text>
              {error ? (
                <Text className="text-[13px]" style={{ color: p.destructive }}>
                  {error}
                </Text>
              ) : null}
              <Button
                label="Approve login"
                onPress={() => void approve()}
                disabled={busy}
                loading={busy}
              />
            </>
          )}
          {approvedAs && (
            <Button
              label="Done"
              variant="secondary"
              onPress={() => router.replace("/(tabs)")}
            />
          )}
        </View>
      </Card>
    </View>
  );
}
