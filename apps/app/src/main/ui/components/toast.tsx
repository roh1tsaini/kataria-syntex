import { Toaster as Sonner } from "sonner";
import * as React from "react";
import { useTheme } from "@/ui/hooks/use-theme";

export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      richColors
      closeButton
      position="bottom-center"
      offset={16}
      mobileOffset={16}
      style={
        {
          "--mobile-offset":
            "calc(16px + env(safe-area-inset-bottom, 0px))" as string,
        } as React.CSSProperties
      }
      swipeDirections={["right", "bottom"]}
      toastOptions={{
        duration: 3800,
        classNames: {
          toast:
            "!rounded-lg !border-border !bg-card !text-card-foreground !shadow-overlay",
          title: "!text-sm !font-semibold",
          description: "!text-[13px] !text-muted-foreground",
          icon: "!size-4",
          actionButton:
            "!rounded-md !bg-primary !text-primary-foreground !text-[13px] !font-medium",
          cancelButton: "!rounded-md !text-[13px]",
          closeButton: "!text-muted-foreground",
        },
      }}
    />
  );
}
