/**
 * Scan-approve — the Android port of apps/app's ScanApprovePage. Opens via
 * the QR payload link (kataria://login/scan/<code>) or by scanning a login
 * QR from another device; requires a session here and grants the waiting
 * device the named account or your own.
 */

import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { api, useAuth, friendlyError } from "@kataria-syntex/app-core";
import { usePalette, withAlpha } from "@/theme";
import { Button, Card, Skeleton } from "@/ui/kit";

type QrInfo = {
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
};

function ScanApproveSkeleton() {
  const p = usePalette();
  return (
    <View
      className="flex-1 items-center justify-center p-4"
      style={{ backgroundColor: p.background }}
    >
      <Card className="w-full max-w-sm">
        <View className="gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-11 w-full rounded-md" />
        </View>
      </Card>
    </View>
  );
}

export default function ScanApproveRoute() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const rawCode = params.code ?? "";
  const code = Array.isArray(rawCode) ? (rawCode[0] ?? "") : rawCode;
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

  // No code in the deep link is unrecoverable — send them to sign-in rather
  // than rendering an approve card that would post an empty code.
  if (status === "loading") return <ScanApproveSkeleton />;
  if (status !== "authed" || !code) {
    return (
      <Redirect
        href={
          code
            ? { pathname: "/auth", params: { returnTo: `/login/scan/${code}` } }
            : "/auth"
        }
      />
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
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor: approvedAs
                ? withAlpha(p.success, 0.1)
                : expiredOrUsed
                  ? withAlpha(p.destructive, 0.1)
                  : withAlpha(p.primary, 0.1),
            }}
          >
            <Feather
              name={
                approvedAs
                  ? "check-circle"
                  : expiredOrUsed
                    ? "alert-triangle"
                    : "shield"
              }
              size={20}
              color={
                approvedAs
                  ? p.success
                  : expiredOrUsed
                    ? p.destructive
                    : p.primary
              }
            />
          </View>
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
