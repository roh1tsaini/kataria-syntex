/**
 * The Android UI kit — the RN counterpart of apps/app's shadcn primitives.
 * Every screen composes these; no page invents its own control styles.
 * Design language: Apple × Luma — generous whitespace, soft borders, one
 * radius ladder, 44px touch targets, dark mode via usePalette().
 *
 * Radii and heights mirror apps/app/design.md §2.2–§2.4 exactly: controls
 * 10px, cards 12px, badges 8px, page title 28px. Pressed states use
 * opacity/scale (native grammar). NO spinners for data loads — skeletons
 * only, and a loading button keeps its label (§3).
 */

import { useEffect, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/cn";
import { useReduceMotion } from "@/lib/motion";
import { usePalette, withAlpha } from "@/theme";
import { Feather, type FeatherIconName } from "@/ui/feather";

// ── Card ────────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className={cn("rounded-lg border p-4", className)}
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
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: !!loading }}
      disabled={inert}
      onPress={onPress}
      className={cn(
        "min-h-[44px] flex-row items-center justify-center rounded-md border px-4",
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
      {/* design.md §3: loading dims the button and nothing is injected — the
          label never changes and spinners are banned. */}
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
    </Pressable>
  );
}

// ── Input ───────────────────────────────────────────────────────────────────

export function Input(props: React.ComponentProps<typeof TextInput>) {
  const p = usePalette();
  const { style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={p.mutedForeground}
      className="min-h-[44px] rounded-md border px-3 text-[15px]"
      // Caller styles merge over the base instead of replacing it, so a screen
      // can tweak padding without losing the palette colors.
      style={[
        { backgroundColor: p.card, borderColor: p.input, color: p.foreground },
        style,
      ]}
      {...rest}
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
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="gap-1.5">
      <Text
        className="text-[13px] font-medium"
        style={{ color: p.foreground }}
        accessibilityLabel={label}
      >
        {label}
      </Text>
      {children}
      {error ? (
        <Text
          className="text-[12px]"
          style={{ color: p.destructive }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "destructive";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const p = usePalette();
  // design.md §2.5/§3: soft tint (10–15% alpha) + ink text + hairline edge.
  const { fg, bg } = {
    accent: { fg: p.accentInk, bg: p.accentSoft },
    success: { fg: p.success, bg: withAlpha(p.success, 0.12) },
    warning: { fg: p.warning, bg: withAlpha(p.warning, 0.12) },
    destructive: { fg: p.destructive, bg: withAlpha(p.destructive, 0.12) },
    neutral: { fg: p.mutedForeground, bg: withAlpha(p.mutedForeground, 0.12) },
  }[tone as BadgeTone];
  return (
    <View
      className="min-h-[20px] items-center justify-center self-start rounded-sm border px-2 py-0.5"
      style={{ backgroundColor: bg, borderColor: withAlpha(fg, 0.25) }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

// ── Page title ──────────────────────────────────────────────────────────────

/** design.md §2.4 page-title scale, at the mobile end of the clamp. */
export function PageTitle({
  children,
  className,
  numberOfLines,
}: {
  children: ReactNode;
  className?: string;
  numberOfLines?: number;
}) {
  const p = usePalette();
  return (
    <Text
      className={cn("text-[28px] font-bold tracking-tight", className)}
      style={{ color: p.foreground }}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

/** design.md §2.4 eyebrow — 11px uppercase, wide tracking. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const p = usePalette();
  return (
    <Text
      className={cn(
        "text-[11px] font-bold uppercase tracking-wider",
        className,
      )}
      style={{ color: p.mutedForeground }}
    >
      {children}
    </Text>
  );
}

// ── Skeleton / EmptyState ───────────────────────────────────────────────────

/** Shimmer block standing in for real content (design.md §3 — `animate-pulse`,
 *  never a spinner). Still under `prefers-reduced-motion`. */
export function Skeleton({ className }: { className?: string }) {
  const p = usePalette();
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduce, progress]);

  const pulse = useAnimatedStyle(() => ({
    opacity: 0.5 + progress.value * 0.5,
  }));

  return (
    <Animated.View
      className={cn("h-4 rounded-sm", className)}
      style={[{ backgroundColor: p.muted }, pulse]}
    />
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: FeatherIconName;
  action?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="items-center gap-2 px-8 py-16">
      {icon ? (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: p.muted }}
        >
          <Feather name={icon} size={20} color={p.mutedForeground} />
        </View>
      ) : null}
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
      {action ? <View className="mt-2">{action}</View> : null}
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
  action?: ReactNode;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <View className="flex-row items-end justify-between px-4 pt-4">
        <View className="flex-1">
          <PageTitle>{title}</PageTitle>
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
