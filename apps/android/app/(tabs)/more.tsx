/**
 * More tab — the phone replacement for the web sidebar's secondary sections:
 * account card with logout, permission-gated nav rows (same gating as
 * apps/app's nav-config — rows the member can't open are hidden), and the
 * sync status row opening the sync sheet.
 */

import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAuth,
  usePermission,
  useSync,
  type Permission,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Button, Card, Screen } from "@/ui/kit";
import { SyncSheet } from "@/ui/sync";

type FeatherGlyph = keyof typeof Feather.glyphMap;

type MoreGroup = { title: string; items: MoreItem[] };
type MoreItem = {
  to: string;
  label: string;
  icon: FeatherGlyph;
  /** Same permission sets as apps/app's nav-config — any-of semantics. */
  permissions: Permission[];
};

const GROUPS: MoreGroup[] = [
  {
    title: "Operations",
    items: [
      {
        to: "/returns",
        label: "Returns",
        icon: "corner-down-left",
        permissions: ["create_return", "edit_return"],
      },
      {
        to: "/raw-material",
        label: "Raw material",
        icon: "box",
        permissions: ["create_raw_material", "edit_raw_material"],
      },
    ],
  },
  {
    title: "Stock",
    items: [
      {
        to: "/stock?kind=raw",
        label: "Stock raw",
        icon: "database",
        permissions: ["view_stock"],
      },
      {
        to: "/stock?kind=dyed",
        label: "Stock dyed",
        icon: "layers",
        permissions: ["view_stock"],
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        to: "/reports",
        label: "Reports",
        icon: "bar-chart-2",
        permissions: ["view_reports"],
      },
    ],
  },
  {
    title: "Organisers",
    items: [
      {
        to: "/colors",
        label: "Colors",
        icon: "droplet",
        permissions: ["manage_masters"],
      },
      {
        to: "/masters",
        label: "Masters",
        icon: "book-open",
        permissions: ["manage_masters"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        to: "/members",
        label: "Members",
        icon: "users",
        permissions: ["manage_members"],
      },
      {
        to: "/devices",
        label: "Devices",
        icon: "smartphone",
        permissions: ["manage_settings"],
      },
      {
        to: "/settings",
        label: "Settings",
        icon: "settings",
        permissions: ["manage_settings"],
      },
    ],
  },
];

function MoreRow({
  icon,
  label,
  onPress,
  divider,
}: {
  icon: FeatherGlyph;
  label: string;
  onPress: () => void;
  divider: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[44px] flex-row items-center px-4 py-3"
      style={({ pressed }) => ({
        gap: 12,
        opacity: pressed ? 0.7 : 1,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: p.border,
      })}
    >
      <Feather name={icon} size={18} color={p.mutedForeground} />
      <Text
        className="flex-1 text-[15px] font-medium"
        style={{ color: p.foreground }}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={p.mutedForeground} />
    </Pressable>
  );
}

export default function MoreTab() {
  const user = useAuth((s) => s.user);
  const workspace = useAuth((s) => s.workspace);
  const company = useAuth((s) => s.company);
  const logout = useAuth((s) => s.logout);
  const can = usePermission();
  const { online, syncing, pendingCount, conflictCount, errorCount } =
    useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const [loggingOut, setLoggingOut] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.permissions.some((perm) => can(perm)),
    ),
  })).filter((group) => group.items.length > 0);

  const syncParts: string[] = [];
  if (conflictCount > 0)
    syncParts.push(
      `${conflictCount} number clash${conflictCount === 1 ? "" : "es"}`,
    );
  if (errorCount > 0) syncParts.push(`${errorCount} failed`);
  if (pendingCount > 0) syncParts.push(`${pendingCount} waiting`);
  if (syncParts.length === 0) {
    syncParts.push(
      online
        ? syncing
          ? "Syncing…"
          : "Everything synced"
        : "Offline — saves stay on this device",
    );
  }

  const onLogout = () => {
    setLoggingOut(true);
    void logout().finally(() => {
      router.replace("/auth");
    });
  };

  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <Screen title="More" subtitle={workspace?.name ?? undefined}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 48,
            gap: 16,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <Text
              className="text-[17px] font-semibold"
              style={{ color: p.foreground }}
            >
              {user?.name ?? "—"}
            </Text>
            <Text
              className="mt-0.5 text-[13px]"
              style={{ color: p.mutedForeground }}
            >
              {workspace?.name ?? "—"}
              {company ? ` · ${company.name}` : ""}
            </Text>
            <View className="mt-3">
              <Button
                label="Log out"
                variant="destructive"
                loading={loggingOut}
                disabled={loggingOut}
                onPress={onLogout}
              />
            </View>
          </Card>

          {visibleGroups.map((group) => (
            <Card key={group.title}>
              <Text
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                {group.title}
              </Text>
              <View className="mt-1 -mx-4 -mb-4">
                {group.items.map((item, i) => (
                  <MoreRow
                    key={item.to}
                    icon={item.icon}
                    label={item.label}
                    divider={i < group.items.length - 1}
                    onPress={() => router.push(item.to)}
                  />
                ))}
              </View>
            </Card>
          ))}

          <Card>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSyncOpen(true)}
              className="min-h-[44px] flex-row items-center py-1"
              style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.7 : 1 })}
            >
              <Feather name="refresh-cw" size={18} color={p.mutedForeground} />
              <View className="flex-1">
                <Text
                  className="text-[15px] font-medium"
                  style={{ color: p.foreground }}
                >
                  Sync status
                </Text>
                <Text
                  className="mt-0.5 text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  {syncParts.join(" · ")}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={p.mutedForeground}
              />
            </Pressable>
          </Card>
        </ScrollView>
      </Screen>
      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
    </View>
  );
}
