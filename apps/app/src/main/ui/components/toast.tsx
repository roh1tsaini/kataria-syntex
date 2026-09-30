import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/ui/hooks/use-theme";

/** Banner sits below the notch / status bar, not at the raw window edge. */
const TOP_OFFSET = "calc(16px + env(safe-area-inset-top, 0px))";

/**
 * Notification banner (design.md §3) — the web surface for app-core's toast
 * sink. Top-centre, drops from the top edge, title + optional description, a
 * tinted status glyph, at most three visible, tap-to-dismiss via the close
 * button or a swipe. Dwell is per kind and set at the sink (`main.tsx`).
 * The enter/exit curve is overridden to `EASE_OUT` in globals.css.
 */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      richColors
      closeButton
      position="top-center"
      offset={{ top: TOP_OFFSET }}
      mobileOffset={{ top: TOP_OFFSET }}
      gap={14}
      visibleToasts={3}
      swipeDirections={["top", "right"]}
      toastOptions={{
        duration: 4000,
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
