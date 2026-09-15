import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { CircleButton } from "@/ui/components/ui/circle-button";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT, MORPH, MORPH_EXIT } from "@/ui/lib/motion";

/**
 * Company settings as a big window on desktop (design.md §3): pinned near the
 * top of the viewport, the app behind it dimmed and blurred. Small screens
 * render the children directly as the page — one surface, breakpoint-decided,
 * so every shell renders the same content (design.md §4.1, AGENTS.md §2.3).
 *
 * Layering: scrim + surface at z-[45], above the sidebar (z-40) and header
 * (z-30) so the blur covers the app, and below every z-50 dialog. The floating
 * window controls sit at z-[60] (title-bar.tsx) so they stay sharp and
 * clickable while the window is open — they are chrome above content
 * (design.md §2.7.1). The surface anchors below the 3.5rem chrome strip so it
 * never visually collides with them.
 */
export function SettingsWindow({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  // Mobile renders the plain page inside the shell's scroll container — no
  // Radix at all, so no portal, focus trap or scroll lock applies there.
  if (!desktop) return <>{children}</>;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[4px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              aria-label={label}
              // Radix unmounts content on close, which kills exit animations —
              // forceMount + AnimatePresence above owns the unmount instead.
            >
              <motion.div
                className={cn(
                  "fixed left-1/2 top-[calc(3.5rem+0.75rem)] z-[45] flex max-h-[calc(100dvh-5rem)] w-[calc(100%-2rem)] max-w-[56rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-overlay [-webkit-app-region:no-drag]",
                )}
                style={{ translate: "-50% 0" }}
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }
                }
                animate={
                  reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
                }
                exit={
                  reduce
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, scale: 0.96, y: 8, transition: MORPH_EXIT }
                }
                transition={MORPH}
              >
                {children}
                <DialogPrimitive.Close asChild>
                  <CircleButton
                    className="absolute right-4 top-4 z-10 bg-card/80 backdrop-blur-sm"
                    aria-label="Close settings"
                    title="Close settings"
                  >
                    <X aria-hidden />
                  </CircleButton>
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function useDesktop() {
  const subscribe = React.useCallback((onChange: () => void) => {
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 768px)").matches,
    // SSR is unreachable (client SPA) — default to the desktop surface.
    () => true,
  );
}
