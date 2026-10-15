/**
 * Button — the web app's seven variants on a Pressable, at the phone scale
 * (h-11 / 44px; the web `sm:h-10` desktop step does not exist on a phone).
 *
 * `ButtonText` carries the label style, because React Native text does not
 * inherit from the button around it.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  PressableScale,
  type PressableScaleProps,
} from "@/components/ui/pressable-scale";
import { Text } from "@/components/ui/text";

export type ButtonVariant =
  | "default"
  | "accent"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: "bg-foreground",
  accent: "bg-primary",
  outline: "border border-border bg-card",
  secondary: "bg-secondary",
  ghost: "",
  destructive: "bg-destructive",
  link: "",
};

const LABEL_CLASSES: Record<ButtonVariant, string> = {
  default: "text-background",
  accent: "text-primary-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
  link: "text-foreground underline",
};

export function ButtonText({
  variant = "default",
  className,
  ...props
}: React.ComponentProps<typeof Text> & { variant?: ButtonVariant }) {
  return (
    <Text
      className={cn(
        "font-medium text-sm tracking-body",
        LABEL_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}

export type ButtonProps = PressableScaleProps & {
  variant?: ButtonVariant;
  size?: "default" | "icon";
  /** Disables the button while an action runs; the label stays put and the
   *  disabled dim is the progress state. No content swap. */
  loading?: boolean;
  label?: string;
  children?: ReactNode;
};

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  label,
  className,
  children,
  disabled,
  accessibilityState,
  ...props
}: ButtonProps) {
  return (
    <PressableScale
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-full",
        size === "icon" ? "size-11" : "h-11 px-4",
        VARIANT_CLASSES[variant],
        disabled || loading ? "opacity-50" : null,
        className,
      )}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
        ...accessibilityState,
      }}
      {...props}
    >
      {label ? <ButtonText variant={variant}>{label}</ButtonText> : null}
      {children}
    </PressableScale>
  );
}
