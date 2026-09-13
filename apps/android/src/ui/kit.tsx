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

import { useEffect, useState, type ReactNode } from "react";
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
import { AppHeader } from "@/ui/app-header";
import { AppIcon, type IconValue } from "@/ui/feather";

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

type ButtonVariant =
  | "default"
  | "accent"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export function Button({
  label,
  onPress,
  variant = "default",
  size = "default",
  disabled,
  loading,
  icon,
  trailingIcon,
  className,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** `sm` mirrors the web compact action (13px label, px-3) — the update
   *  banner action. Heights stay 44px: Android pointers are always coarse. */
  size?: "default" | "sm";
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading glyph, matching apps/app's icon+label buttons. */
  icon?: IconValue;
  /** Optional trailing glyph — web icon+label buttons keep 8px inline gaps. */
  trailingIcon?: IconValue;
  className?: string;
}) {
  const p = usePalette();
  const inert = disabled || loading;
  // Web ui/button.tsx mapped 1:1 — `default` is the foreground fill and the
  // no-variant default, `accent` is the primary fill, `secondary` is the
  // filled bg-secondary, `outline` is card bg + hairline.
  const fill =
    variant === "accent"
      ? p.primary
      : variant === "default"
        ? p.foreground
        : variant === "destructive"
          ? p.destructive
          : variant === "secondary"
            ? p.secondary
            : variant === "outline"
              ? p.card
              : "transparent";
  const ink =
    variant === "accent"
      ? p.primaryForeground
      : variant === "default"
        ? p.background
        : variant === "destructive"
          ? p.destructiveForeground
          : variant === "secondary"
            ? p.secondaryForeground
            : p.foreground;
  const edge = variant === "outline" ? p.border : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: !!loading }}
      disabled={inert}
      onPress={onPress}
      className={cn(
        "min-h-[44px] flex-row items-center justify-center rounded-md border",
        size === "sm" ? "px-3" : "px-4",
        inert && "opacity-50",
        className,
      )}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : inert ? 0.5 : 1,
        transform: pressed && !inert ? [{ scale: 0.97 }] : [{ scale: 1 }],
        backgroundColor: fill,
        borderColor: edge,
      })}
    >
      {/* design.md §3: loading dims the button and nothing is injected — the
          label never changes and spinners are banned. */}
      {icon ? (
        <AppIcon name={icon} size={16} color={ink} style={{ marginRight: 8 }} />
      ) : null}
      <Text
        className={cn(
          "font-medium",
          size === "sm" ? "text-[13px]" : "text-[14px]",
        )}
        style={{ color: ink }}
      >
        {label}
      </Text>
      {trailingIcon ? (
        <AppIcon
          name={trailingIcon}
          size={16}
          color={ink}
          style={{ marginLeft: 8 }}
        />
      ) : null}
    </Pressable>
  );
}

// ── CircleButton / ButtonCapsule ────────────────────────────────────────────

/** design.md §2.7: a lone icon action is a circle — hairline border,
 *  transparent at rest, muted while pressed, pressing to scale(0.9). Android
 *  is always a coarse pointer, so the circle is the 44px touch size. */
export function CircleButton({
  label,
  onPress,
  disabled,
  children,
  className,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "h-11 w-11 shrink-0 items-center justify-center rounded-full border",
        className,
      )}
      style={({ pressed }) => ({
        borderColor: p.border,
        backgroundColor: pressed ? p.muted : "transparent",
        opacity: disabled ? 0.5 : 1,
        transform: pressed && !disabled ? [{ scale: 0.9 }] : [{ scale: 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

/** Capsule joining adjacent CircleButtons into one cluster (§2.7):
 *  bg-muted/60, p-1, gap-1. Never used for navigation rows. */
export function ButtonCapsule({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const p = usePalette();
  return (
    <View
      className={cn("flex-row items-center gap-1 rounded-full p-1", className)}
      style={{ backgroundColor: withAlpha(p.muted, 0.6) }}
    >
      {children}
    </View>
  );
}

// ── Input ───────────────────────────────────────────────────────────────────

export function Input({
  invalid,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof TextInput> & { invalid?: boolean }) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const { style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={p.mutedForeground}
      className="min-h-[44px] rounded-md border px-3 text-[15px]"
      // Focus is a border-color change only (--ring), never a halo — the
      // same contract as apps/app's .field-control.
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      // Caller styles merge over the base instead of replacing it, so a screen
      // can tweak padding without losing the palette colors.
      style={[
        {
          backgroundColor: p.card,
          borderColor: invalid ? p.destructive : focused ? p.primary : p.input,
          color: p.foreground,
        },
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

type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "success-soft"
  | "warning"
  | "destructive"
  | "secondary"
  | "outline";

export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  /** Optional leading glyph, matching the web role badges (gap-1). */
  icon?: IconValue;
}) {
  const p = usePalette();
  // design.md §2.5/§3: soft tint (10–15% alpha) + ink text + hairline edge.
  // `secondary` is web ui/badge.tsx secondary: filled bg-secondary, no border.
  const { fg, bg, bordered } = {
    accent: { fg: p.accentInk, bg: p.accentSoft, bordered: true },
    success: { fg: p.success, bg: withAlpha(p.success, 0.12), bordered: true },
    // Web challans-editor's borderless bg-success/10 weight span.
    "success-soft": {
      fg: p.success,
      bg: withAlpha(p.success, 0.1),
      bordered: false,
    },
    warning: { fg: p.warning, bg: withAlpha(p.warning, 0.12), bordered: true },
    destructive: {
      fg: p.destructive,
      bg: withAlpha(p.destructive, 0.12),
      bordered: true,
    },
    neutral: {
      fg: p.mutedForeground,
      bg: withAlpha(p.mutedForeground, 0.12),
      bordered: true,
    },
    secondary: {
      fg: p.secondaryForeground,
      bg: p.secondary,
      bordered: false,
    },
    // Web ui/badge.tsx outline: card bg, hairline border-border, ink text —
    // the Clash / Waiting-to-sync badges.
    outline: { fg: p.foreground, bg: p.card, bordered: true },
  }[tone as BadgeTone];
  return (
    <View
      className="min-h-[20px] flex-row items-center gap-1 self-start rounded-sm border px-1.5 py-0.5"
      style={{
        backgroundColor: bg,
        borderColor:
          tone === "outline"
            ? p.border
            : bordered
              ? withAlpha(fg, 0.25)
              : "transparent",
      }}
    >
      {icon ? <AppIcon name={icon} size={12} color={fg} /> : null}
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

// ── Skeleton / EmptyState ───────────────────────────────────────────────────

/** Shimmer block standing in for real content (design.md §3 — `animate-pulse`,
 *  never a spinner). Still under `prefers-reduced-motion`. */
export function Skeleton({ className }: { className?: string }) {
  const p = usePalette();
  const reduce = useReduceMotion();
  // animation covers the web's 2s pulse exactly (50% → opacity .5); under
  // reduced motion the block rests fully visible, as globals.css collapses it.
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = withRepeat(
      withTiming(0, {
        duration: 2000,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
      }),
      -1,
      true,
    );
  }, [reduce, progress]);

  const pulse = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : 0.5 + progress.value * 0.5,
  }));

  return (
    <Animated.View
      className={cn("h-4 rounded-lg", className)}
      style={[{ backgroundColor: p.muted }, pulse]}
    />
  );
}

export function EmptyState({
  title,
  message,
  icon,
  iconTone = "default",
  action,
  className,
}: {
  title: string;
  message?: string;
  icon?: IconValue;
  /** Error empties use the destructive tone — web bg-destructive/10 ink. */
  iconTone?: "default" | "destructive";
  action?: ReactNode;
  /** Padding seam — web register empties override to `px-4 py-10`. */
  className?: string;
}) {
  const p = usePalette();
  return (
    <View className={cn("items-center gap-6 px-8 py-16", className)}>
      {icon ? (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{
            backgroundColor:
              iconTone === "destructive"
                ? withAlpha(p.destructive, 0.1)
                : p.muted,
          }}
        >
          <AppIcon
            name={icon}
            size={20}
            color={
              iconTone === "destructive" ? p.destructive : p.mutedForeground
            }
          />
        </View>
      ) : null}
      <Text
        className="text-[15px] font-semibold tracking-tight"
        style={{ color: p.foreground }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          className="text-center text-[14px]"
          style={{ color: p.mutedForeground }}
        >
          {message}
        </Text>
      ) : null}
      {action ? <View>{action}</View> : null}
    </View>
  );
}

// ── Screen (page container) ─────────────────────────────────────────────────

export function Screen({
  eyebrow,
  title,
  headerLabel,
  description,
  action,
  banner,
  children,
}: {
  /** Uppercase micro-label above the title (apps/app PageHeader eyebrow). */
  eyebrow?: string;
  title: string;
  /** Center label in the header bar. Defaults to the title — set it when the
   *  title is a record (challan number) and the shell would name the section. */
  headerLabel?: string;
  description?: string;
  /** Full-width primary action below the description on mobile, exactly as
   *  apps/app renders PageHeader actions at the mobile breakpoint. */
  action?: ReactNode;
  /** Shell strip between the header and the page title (sync banner). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <AppHeader label={headerLabel ?? title} />
      {banner}
      <View className="flex-1">
        <View className="px-4 pt-5">
          {eyebrow ? (
            <Text
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <PageTitle className="mt-1.5">{title}</PageTitle>
          {description ? (
            <Text
              className="mt-1.5 text-[15px] leading-6"
              style={{ color: p.mutedForeground }}
            >
              {description}
            </Text>
          ) : null}
          {action ? <View className="mt-4">{action}</View> : null}
        </View>
        <View className="flex-1 pt-4">{children}</View>
      </View>
    </View>
  );
}
