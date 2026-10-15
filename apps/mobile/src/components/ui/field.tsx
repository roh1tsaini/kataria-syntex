/** Field — label / description / error, the web `ui/field.tsx` contract. */
import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";
import { Text } from "@/components/ui/text";

export function Field({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("flex-col gap-3", className)}
      accessibilityRole="none"
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn(
        "font-medium text-[13px] leading-[1.4] text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function FieldDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("text-xs leading-[1.5] text-muted-foreground", className)}
      {...props}
    />
  );
}

export function FieldError({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      accessibilityRole="alert"
      className={cn("text-xs leading-[1.5] text-destructive", className)}
      {...props}
    />
  );
}
