import { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  type LucideIcon,
} from "lucide-react-native";
import { useAuth } from "@kataria-syntex/app-core";

import { Page } from "@/components/page";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  Eyebrow,
  PageDescription,
  PageTitle,
  Text,
} from "@/components/ui/text";
import { useTheme, type ThemePreference } from "@/theme/theme";
import { appVersion } from "@/platform/adapter";
import { updateFailureCopy, useUpdates } from "@/platform/update-flow";
import { cn } from "@/lib/cn";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: "system",
    label: "System",
    hint: "Follows device",
    icon: Monitor,
  },
  { value: "light", label: "Light", hint: "Bright theme", icon: Sun },
  { value: "dark", label: "Dark", hint: "Dim theme", icon: Moon },
];

export function SettingsScreen() {
  const router = useRouter();
  const { preference, setTheme } = useTheme();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  // Update state comes from the Android update flow seam; on the web export it
  // stays idle (checks never run), so the row renders its resting state.
  const latestVersion = useUpdates((s) => s.latestVersion);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const failure = useUpdates((s) => s.failure);
  const checking = useUpdates((s) => s.checking);
  const checkNow = useUpdates((s) => s.checkNow);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const retryUpdate = useUpdates((s) => s.retryUpdate);
  const [result, setResult] = useState<string | null>(null);
  const [retryInFlight, setRetryInFlight] = useState(false);

  const downloading = status === "downloading";
  const installing = status === "installing";
  const busy = downloading || installing;
  const installable = latestVersion !== null && status === "ready";
  const retrying = failure !== null || retryInFlight;
  const showAction = !retryInFlight && (installable || busy);

  const handleCheckUpdates = async () => {
    setResult(null);
    const outcome = await checkNow();
    setResult(
      outcome === "up-to-date" ? "You're on the latest version." : null,
    );
  };

  const handleRetry = async () => {
    setRetryInFlight(true);
    try {
      await retryUpdate();
    } finally {
      const current = useUpdates.getState();
      if (
        !current.checking &&
        current.status !== "downloading" &&
        current.status !== "installing"
      ) {
        setRetryInFlight(false);
      }
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <Page>
      <Eyebrow>App</Eyebrow>
      <PageTitle className="mt-1.5">Settings</PageTitle>
      <PageDescription className="mt-2">
        Theme, updates, devices and account preferences.
      </PageDescription>

      {/* Account Profile Card */}
      {user ? (
        <Card className="mt-6 p-4">
          <Text className="font-semibold text-sm text-foreground">
            Signed in as
          </Text>
          <Text className="mt-1 font-medium text-base text-foreground">
            {user.name || "User"}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {user.phone || user.email || "No identifier"}
          </Text>
          <Button
            variant="outline"
            className="mt-4 flex-row gap-2"
            onPress={handleSignOut}
            accessibilityLabel="Sign out of account"
          >
            <LogOut size={16} />
            <ButtonText variant="outline">Sign out</ButtonText>
          </Button>
        </Card>
      ) : null}

      {/* Appearance Section */}
      <Card className="mt-6 overflow-hidden">
        <View className="border-b border-border px-4 py-3">
          <Text className="font-semibold text-sm text-foreground">Theme</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            Applies on this device only.
          </Text>
        </View>
        <View className="flex-row gap-2 p-4">
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value;
            const Icon = opt.icon;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setTheme(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${opt.label} theme`}
                className={cn(
                  "flex-1 items-center justify-center rounded-lg border p-3",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card",
                )}
              >
                <Icon
                  size={20}
                  className={cn(
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <Text
                  className={cn(
                    "mt-2 font-medium text-xs",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Devices Section */}
      <Card className="mt-6 overflow-hidden">
        <Pressable
          onPress={() => router.push("/devices")}
          className="flex-row items-center justify-between p-4"
          accessibilityRole="button"
          accessibilityLabel="Manage signed-in devices"
        >
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-lg bg-muted">
              <Smartphone size={18} />
            </View>
            <View>
              <Text className="font-semibold text-sm text-foreground">
                Devices
              </Text>
              <Text className="text-xs text-muted-foreground">
                Manage signed-in sessions & QR login
              </Text>
            </View>
          </View>
          <ChevronRight size={18} className="text-muted-foreground" />
        </Pressable>
      </Card>

      {/* Version & Updates — same rows and labels as the web Settings panel. */}
      <Card className="mt-6 overflow-hidden">
        <View className="flex-row items-center justify-between gap-4 border-b border-border px-4 py-3">
          <Text className="text-[13px] font-medium text-foreground">
            Version
          </Text>
          <Text className="font-mono text-[13px] font-semibold text-primary">
            v{appVersion()}
          </Text>
        </View>
        <View className="gap-3 px-4 py-3">
          <View className="flex-row items-center justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-medium text-foreground">
                Updates
              </Text>
              {failure ? (
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {updateFailureCopy(failure)}
                </Text>
              ) : result ? (
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {result}
                </Text>
              ) : null}
            </View>
            {!showAction ? (
              <Button
                variant="outline"
                onPress={() =>
                  void (retrying ? handleRetry() : handleCheckUpdates())
                }
                disabled={checking || retryInFlight}
                loading={checking || retryInFlight}
                accessibilityLabel={
                  retrying ? "Retry update check" : "Check for app updates"
                }
              >
                <RefreshCw size={14} />
                <ButtonText variant="outline" className="text-xs">
                  {retrying ? "Retry" : "Check"}
                </ButtonText>
              </Button>
            ) : null}
          </View>
          {downloading && progress ? (
            <ProgressBar
              percent={progress.percent}
              totalBytes={progress.totalBytes}
            />
          ) : installable ? (
            <Text className="text-xs tabular-nums text-muted-foreground">
              v{latestVersion} available
            </Text>
          ) : null}
          {showAction ? (
            <Button
              className="w-full"
              label="Update"
              onPress={() => void installUpdate()}
              loading={busy}
              disabled={busy}
            />
          ) : null}
        </View>
      </Card>
    </Page>
  );
}
