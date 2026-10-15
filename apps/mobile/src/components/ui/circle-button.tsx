/**
 * CircleButton / ButtonCapsule — the icon-action vocabulary (design.md
 * Section 2.7). Every circle button is a 44px touch target with a hairline
 * border; adjacent ones join into one capsule.
 */
import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";
import {
  PressableScale,
  type PressableScaleProps,
} from "@/components/ui/pressable-scale";

export function CircleButton({
  className,
  size = "touch",
  children,
  ...props
}: PressableScaleProps & {
  size?: "md" | "touch";
  children?: ReactNode;
}) {
  return (
    <PressableScale
      className={cn(
        "size-11 shrink-0 items-center justify-center rounded-full border border-border-soft",
        className,
      )}
      accessibilityRole="button"
      {...props}
    >
      {children}
    </PressableScale>
  );
}

/** Capsule that joins adjacent CircleButtons into one cluster. The hairline
 *  top edge is the web app's `--specular` inner highlight. */
export function ButtonCapsule({
  className,
  vertical = false,
  ...props
}: ViewProps & { vertical?: boolean }) {
  return (
    <View
      className={cn(
        "items-center gap-1 rounded-full bg-muted-veil p-1",
        // The specular edge, as a hairline rather than an inset shadow.
        "border-t border-[color:var(--specular)]",
        vertical ? "flex-col" : "flex-row",
        className,
      )}
      {...props}
    />
  );
}
