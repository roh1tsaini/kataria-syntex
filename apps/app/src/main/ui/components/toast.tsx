import { useCallback, useSyncExternalStore } from "react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/ui/hooks/use-theme";

/** Toast sits below the notch / status bar, not at the raw window edge. */
const TOP_OFFSET = "calc(16px + var(--safe-area-inset-top))";

/** ≥sm toasts hug the right edge — same 16px inset as the top. */
const WIDE_OFFSET = { top: TOP_OFFSET, right: "16px" };
const NARROW_OFFSET = { top: TOP_OFFSET };

function useWideViewport() {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia("(min-width: 640px)");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 640px)").matches,
    () => false,
  );
}

/**
 * Notification toast (design.md Section 3.2) — the web surface for app-core's
 * toast sink. Top-centre on phones (≤sm), top-right on wider screens (16px
 * inset) — same bundle, breakpoint-decided. Drops in on `EASE_OUT`, title +
 * optional description, a tinted status glyph, at most three visible,
 * tap-to-dismiss via the close button or a swipe. Dwell is per kind and set
 * at the sink (`main.tsx`). The enter/exit curve is overridden in globals.css.
 */
export function Toaster() {
  const { theme } = useTheme();
  const wide = useWideViewport();
  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      richColors
      closeButton
      position={wide ? "top-right" : "top-center"}
      offset={wide ? WIDE_OFFSET : NARROW_OFFSET}
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
