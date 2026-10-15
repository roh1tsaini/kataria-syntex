/**
 * Input — the web `field-control` surface: 44px tall, hairline border, and a
 * border-only focus state (no halo, nothing to clip).
 */
import { useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useUnstableNativeVariable } from "nativewind";

import { cn } from "@/lib/cn";

export function Input({
  className,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { className?: string }) {
  const [focused, setFocused] = useState(false);
  const placeholder = useUnstableNativeVariable("--muted-foreground");
  const selection = useUnstableNativeVariable("--primary");

  return (
    <TextInput
      className={cn(
        "h-11 w-full rounded-md border bg-card px-3 font-sans text-[15px] text-foreground",
        focused ? "border-ring" : "border-input",
        className,
      )}
      placeholderTextColor={
        typeof placeholder === "string" ? placeholder : undefined
      }
      selectionColor={typeof selection === "string" ? selection : undefined}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}
