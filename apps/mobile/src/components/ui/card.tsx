/** Card — the web `ui/card.tsx` surface, same padding and radius ladder. */
import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";
import { Text } from "@/components/ui/text";

export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn("flex-col gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn(
        "font-semibold text-base leading-[1.2] tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("text-sm leading-[1.5] text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("p-5 pt-0", className)} {...props} />;
}

/** Plain titled block used inside cards on the phone layout. */
export function CardSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={cn("p-5", className)}>{children}</View>;
}
