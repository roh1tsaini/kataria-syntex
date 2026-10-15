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
import {
  Eyebrow,
  PageDescription,
  PageTitle,
  Text,
} from "@/components/ui/text";
import { useTheme, type ThemePreference } from "@/theme/theme";
import { appVersion } from "@/platform/adapter";
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
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateStatus(null);
    try {
      // Simulate check against release origin
      await new Promise((r) => setTimeout(r, 800));
      setUpdateStatus("App is up to date");
    } finally {
      setCheckingUpdates(false);
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

      {/* App Version & Updates Section */}
      <Card className="mt-6 p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-sm text-foreground">
              Kataria Syntex Mobile
            </Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              Version {appVersion()}
            </Text>
          </View>
          <Button
            variant="outline"
            className="h-9 px-3 flex-row gap-1.5"
            onPress={handleCheckUpdates}
            loading={checkingUpdates}
            accessibilityLabel="Check for app updates"
          >
            <RefreshCw size={14} />
            <ButtonText variant="outline" className="text-xs">
              Check updates
            </ButtonText>
          </Button>
        </View>
        {updateStatus ? (
          <Text className="mt-3 text-xs text-muted-foreground">
            {updateStatus}
          </Text>
        ) : null}
      </Card>
    </Page>
  );
}
