/**
 * The Android UI kit — the RN counterpart of apps/app's shadcn primitives.
 * Every screen composes these; no page invents its own control styles.
 * Design language: Apple × Luma — generous whitespace, soft borders, one
 * radius ladder, 44px touch targets, dark mode via usePalette().
 *
 * Pressed states use opacity/scale (native grammar); motion is the
 * platform's own. NO spinners for data loads — skeletons only.
 */

import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { cn } from "@/lib/cn";
import { usePalette } from "@/theme";

/**
 * Press feedback shared by every tappable control: scale 0.97 @ ~100ms
 * (design.md §5 rule 6) plus the caller's opacity dip. Instant on press,
 * springs back on release — never a delayed or jumpy transform.
 */
export const PRESS_SCALE = { transform: [{ scale: 0.97 }] };

// ── Card ────────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className={cn("rounded-xl border p-4", className)}
      style={{ backgroundColor: p.card, borderColor: p.border }}
    >
      {children}
    </View>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  className,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const p = usePalette();
  const inert = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert }}
      disabled={inert}
      onPress={onPress}
      className={cn(
        "min-h-[44px] flex-row items-center justify-center rounded-lg border px-4",
        (variant === "secondary" || variant === "ghost") && "bg-transparent",
        inert && "opacity-50",
        className,
      )}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : inert ? 0.5 : 1,
        transform: pressed && !inert ? [{ scale: 0.97 }] : [{ scale: 1 }],
        backgroundColor:
          variant === "primary"
            ? p.primary
            : variant === "destructive"
              ? p.destructive
              : "transparent",
        borderColor: variant === "secondary" ? p.border : "transparent",
      })}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? p.primaryForeground : p.foreground}
        />
      ) : (
        <Text
          className="text-[15px] font-semibold"
          style={{
            color:
              variant === "primary"
                ? p.primaryForeground
                : variant === "destructive"
                  ? p.destructiveForeground
                  : p.foreground,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── Input ───────────────────────────────────────────────────────────────────

export function Input(props: React.ComponentProps<typeof TextInput>) {
  const p = usePalette();
  return (
    <TextInput
      placeholderTextColor={p.mutedForeground}
      className="min-h-[44px] rounded-lg border px-3 text-[15px]"
      style={{
        backgroundColor: p.card,
        borderColor: p.input,
        color: p.foreground,
      }}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="gap-1.5">
      <Text className="text-[13px] font-medium" style={{ color: p.foreground }}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text className="text-[12px]" style={{ color: p.destructive }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "destructive";
}) {
  const p = usePalette();
  const color =
    tone === "accent"
      ? p.accentInk
      : tone === "success"
        ? p.success
        : tone === "warning"
          ? p.warning
          : tone === "destructive"
            ? p.destructive
            : p.mutedForeground;
  return (
    <View
      className="self-start rounded-md px-2 py-0.5"
      style={{ backgroundColor: p.muted }}
    >
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

// ── Row (list cell) ─────────────────────────────────────────────────────────

export function Row({
  title,
  subtitle,
  trailing,
  onPress,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      className="min-h-[44px] flex-row items-center justify-between gap-3 px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        transform: pressed ? [{ scale: 0.97 }] : [{ scale: 1 }],
      })}
    >
      <View className="flex-1">
        <Text
          className="text-[15px] font-medium"
          style={{ color: p.foreground }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-[13px]"
            style={{ color: p.mutedForeground }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

// ── Skeleton / EmptyState ───────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  const p = usePalette();
  return (
    <View
      className={cn("h-4 rounded-md", className)}
      style={{ backgroundColor: p.muted }}
    />
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  const p = usePalette();
  return (
    <View className="items-center gap-1 px-8 py-16">
      <Text
        className="text-[15px] font-semibold"
        style={{ color: p.foreground }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          className="text-center text-[13px]"
          style={{ color: p.mutedForeground }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

// ── Screen (page container) ─────────────────────────────────────────────────

export function Screen({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <View className="flex-row items-end justify-between px-4 pt-4">
        <View className="flex-1">
          <Text
            className="text-[22px] font-bold"
            style={{ color: p.foreground }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className="mt-0.5 text-[13px]"
              style={{ color: p.mutedForeground }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      <View className="flex-1 pt-4">{children}</View>
    </View>
  );
}
