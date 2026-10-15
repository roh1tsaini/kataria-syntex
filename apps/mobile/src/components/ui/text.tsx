/**
 * Text primitives.
 *
 * React Native has no inherited type styles, so every string in this app is
 * rendered through `Text` (or one of the page-type helpers below) — that is how
 * Inter and the foreground color reach it. The scale mirrors the web app's
 * component classes (globals.css): eyebrow, title, description, micro-label.
 */
import { Text as RNText, type TextProps } from "react-native";

import { cn } from "@/lib/cn";

export function Text({ className, ...props }: TextProps) {
  return (
    <RNText className={cn("font-sans text-foreground", className)} {...props} />
  );
}

/** Page eyebrow — 11px semibold uppercase, muted, 0.08em tracking. */
export function Eyebrow({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        "font-semibold text-[11px] uppercase tracking-label text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Page title — 28px bold, -0.022em tracking. The phone end of the web
 *  clamp(28px…36px). */
export function PageTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        "font-bold text-[28px] leading-[1.05] tracking-title",
        className,
      )}
      {...props}
    />
  );
}

/** Page description — 15px, muted, relaxed leading. */
export function PageDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        "font-sans text-[15px] leading-[1.6] tracking-body text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Section micro-label — 11px semibold uppercase, muted, 0.06em tracking. */
export function MicroLabel({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        "font-semibold text-[11px] uppercase tracking-micro text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
