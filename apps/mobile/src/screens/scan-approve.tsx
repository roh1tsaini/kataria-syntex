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

  if (!code || status === "guest") {
    router.replace({
      pathname: "/auth",
      params: { next: `/login/scan/${code}` },
    });
    return null;
  }

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center p-6 bg-background">
        <Skeleton className="h-64 w-full max-w-sm rounded-lg" />
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
              <ShieldCheck size={20} className="text-primary" />
            </View>
            <CardTitle>Approve sign-in</CardTitle>
            <CardDescription>
              Another device wants to sign in to your Kataria Syntex account.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {error && (
              <View className="rounded-md bg-destructive/10 p-3">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            )}

            {approvedAs ? (
              <View className="items-center gap-2 py-4">
                <CheckCircle2 size={32} className="text-primary" />
                <Text className="font-semibold text-base text-foreground">
                  Sign-in approved
                </Text>
                <Text className="text-center text-xs text-muted-foreground">
                  The device was signed in as {approvedAs}. You can manage it
                  under Settings &gt; Devices.
                </Text>
                <Button
                  className="mt-2 w-full"
                  onPress={() => router.replace("/")}
                >
                  <ButtonText>Done</ButtonText>
                </Button>
              </View>
            ) : alreadyApproved ? (
              <View className="gap-2 py-2">
                <Text className="text-sm text-muted-foreground">
                  This code was already approved.
                </Text>
                <Button variant="outline" onPress={() => router.replace("/")}>
                  <ButtonText variant="outline">Go to home</ButtonText>
                </Button>
              </View>
            ) : expiredOrUsed ? (
              <View className="gap-2 py-2">
                <Text className="text-sm text-destructive">
                  This code has expired or is no longer valid.
                </Text>
                <Button variant="outline" onPress={() => router.replace("/")}>
                  <ButtonText variant="outline">Go to home</ButtonText>
                </Button>
              </View>
            ) : (
              <View className="gap-4">
                <View className="rounded-lg border border-border bg-muted/30 p-3 gap-1">
                  <Text className="text-xs text-muted-foreground">
                    Pairing code suffix:
                  </Text>
                  <Text className="font-mono font-bold text-sm text-foreground">
                    ••••-{codeSuffix(code)}
                  </Text>
                  {info?.deviceLabel && (
                    <Text className="mt-1 text-xs text-muted-foreground">
                      Device: {info.deviceLabel}
                    </Text>
                  )}
                </View>

                <Button
                  onPress={approve}
                  loading={busy}
                  accessibilityLabel="Approve device sign-in"
                >
                  <ButtonText>Approve sign-in</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => router.replace("/")}
                  disabled={busy}
                  accessibilityLabel="Decline sign-in"
                >
                  <ButtonText variant="outline">Decline</ButtonText>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </Page>
  );
}
