import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, ShieldCheck } from "lucide-react-native";
import { api, friendlyError, useAuth } from "@kataria-syntex/app-core";

import { Page } from "@/components/page";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

type QrInfo = {
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
  deviceLabel: string | null;
};

/** Last group of the pairing code, so the two screens can be compared. */
function codeSuffix(code: string): string {
  return code.split("-").pop() ?? code;
}

export function ScanApproveScreen({ code }: { code: string }) {
  const router = useRouter();
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

  // Approving needs a session on THIS device. Redirect from an effect —
  // navigating during render runs before the route has mounted.
  const redirectToAuth = !code || status === "guest";

  useEffect(() => {
    if (!redirectToAuth) return;
    router.replace({
      pathname: "/auth",
      params: { next: `/login/scan/${code}` },
    });
  }, [redirectToAuth, code, router]);

  if (redirectToAuth) return null;

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <View className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <Skeleton className="mb-2 size-10 rounded-lg" />
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="gap-3">
              <View className="gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                {[0, 1, 2].map((row) => (
                  <View
                    key={row}
                    className="flex-row items-center justify-between gap-3"
                  >
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </View>
                ))}
              </View>
              <Skeleton className="h-11 w-full rounded-full" />
            </CardContent>
          </Card>
        </View>
      </View>
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
    <Page contentClassName="items-center justify-center min-h-full py-8">
      <View className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <View className="mb-2 size-10 items-center justify-center rounded-lg bg-primary/10">
              {approvedAs ? (
                <CheckCircle2 size={20} className="text-primary" />
              ) : (
                <ShieldCheck size={20} className="text-primary" />
              )}
            </View>
            <CardTitle>
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
                  {`${info?.deviceLabel || "That device"} is now signed in as `}
                  <Text className="font-medium text-foreground">
                    {approvedAs}
                  </Text>
                  .
                </>
              ) : expiredOrUsed ? (
                "Ask the other device to show a fresh QR code."
              ) : alreadyApproved ? (
                "This code was already approved."
              ) : (
                "Check the device and code match that screen."
              )}
            </CardDescription>
          </CardHeader>
          {!approvedAs && !expiredOrUsed && !alreadyApproved ? (
            <CardContent className="gap-3">
              {/* Name the requesting device, not just the account: the label
                  is the requester's own claim from an unauthenticated header,
                  so the row says "Claims to be". "Signs in as" and "Code ends
                  in" are the facts the server knows. */}
              <View className="gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="text-[13px] text-muted-foreground">
                    Claims to be
                  </Text>
                  <Text
                    className="min-w-0 flex-1 text-right font-medium text-[13px] text-foreground"
                    numberOfLines={1}
                  >
                    {info?.deviceLabel || "unknown device"}
                  </Text>
                </View>
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="text-[13px] text-muted-foreground">
                    Signs in as
                  </Text>
                  <Text
                    className="min-w-0 flex-1 text-right font-medium text-[13px] text-foreground"
                    numberOfLines={1}
                  >
                    {info?.targetName || "you"}
                  </Text>
                </View>
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="text-[13px] text-muted-foreground">
                    Code ends in
                  </Text>
                  <Text className="font-mono font-semibold text-[13px] tracking-widest text-foreground">
                    {codeSuffix(code)}
                  </Text>
                </View>
              </View>
              {error && (
                <View className="rounded-md bg-destructive/10 p-3">
                  <Text className="text-xs text-destructive">{error}</Text>
                </View>
              )}
              <Button
                onPress={() => void approve()}
                loading={busy}
                accessibilityLabel="Approve login"
              >
                <ButtonText>Approve login</ButtonText>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </View>
    </Page>
  );
}
