import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT, MORPH, MORPH_EXIT } from "@/ui/lib/motion";

type DialogContextType = { open: boolean };

const DialogContext = React.createContext<DialogContextType | null>(null);

/**
 * Root that shares its open state with the content. Radix unmounts content
 * the moment it closes, which kills exit animations — so the animated
 * surface reads the state from here and runs its own exit inside
 * AnimatePresence. Same API as Radix Root (controlled in this app).
 */
export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolled;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DialogContext.Provider value={{ open }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
}

function useMobileSheet() {
  const subscribe = React.useCallback((onChange: () => void) => {
    const mq = window.matchMedia("(max-width: 639px)");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}

/**
 * Morphing dialog surface (design.md §5.6): the panel springs open —
 * desktop scales 0.96→1 from center, ≤sm slides up as a bottom sheet — and
 * exits on the same path ~20% faster. The centering translate lives in the
 * CSS `translate` property (Tailwind classes), so motion's `transform`
 * never fights it.
 */
export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Blocking dialogs (update gate) render no close affordance. */
    hideClose?: boolean;
  }
>(({ className, children, hideClose, ...props }, ref) => {
  const ctx = React.useContext(DialogContext);
  const open = ctx?.open ?? false;
  const reduce = useReducedMotion();
  const sheet = useMobileSheet();

  const initial = reduce
    ? { opacity: 0 }
    : sheet
      ? { y: "100%" }
      : { opacity: 0, scale: 0.96, y: 8 };
  const animate = reduce
    ? { opacity: 1 }
    : sheet
      ? { y: 0 }
      : { opacity: 1, scale: 1, y: 0 };
  const exit = reduce
    ? { opacity: 0, transition: { duration: 0 } }
    : sheet
      ? { y: "100%", transition: MORPH_EXIT }
      : { opacity: 0, scale: 0.96, y: 8, transition: MORPH_EXIT };

  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[4px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount {...props}>
            <motion.div
              ref={ref}
              className={cn(
                // Desktop: centered modal, 16px radius.
                "fixed left-1/2 top-1/2 z-50 grid w-full max-w-md gap-4 rounded-xl border border-border bg-card p-6 shadow-overlay",
                // Mobile: iOS bottom sheet.
                "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0))]",
                className,
              )}
              style={sheet ? undefined : { translate: "-50% -50%" }}
              initial={initial}
              animate={animate}
              exit={exit}
              transition={MORPH}
            >
              {children}
              {!hideClose && (
                <DialogPrimitive.Close className="absolute right-4 top-4 grid size-11 place-items-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10">
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
});
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
