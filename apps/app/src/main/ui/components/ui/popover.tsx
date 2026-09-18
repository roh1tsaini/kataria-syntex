import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/ui/lib/cn";
import { MORPH, MORPH_EXIT } from "@/ui/lib/motion";

type PopoverContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const PopoverContext = React.createContext<PopoverContextType | null>(null);

export function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </PopoverContext.Provider>
  );
}

export const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, onClick, asChild = false, children, ...props }, ref) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverTrigger must be used inside Popover");

  const combinedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      (
        ctx.triggerRef as React.MutableRefObject<HTMLButtonElement | null>
      ).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ctx.triggerRef, ref],
  );

  const triggerProps = {
    "aria-expanded": ctx.open,
    "aria-haspopup": "dialog" as const,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        ctx.setOpen(!ctx.open);
      }
    },
    className,
    ...props,
  };

  if (asChild) {
    return (
      <Slot ref={combinedRef} {...triggerProps}>
        {children}
      </Slot>
    );
  }

  return (
    <button ref={combinedRef} type="button" {...triggerProps}>
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  // Narrow on purpose: motion redefines most DOM gesture/animation handlers,
  // so a broad HTMLAttributes spread never typechecks against motion props.
  {
    align?: "start" | "center" | "end";
    sideOffset?: number;
    className?: string;
    children?: React.ReactNode;
  }
>(({ className, align = "start", sideOffset = 4, children }, ref) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverContent must be used inside Popover");

  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
    side: "bottom" | "top";
  } | null>(null);

  React.useLayoutEffect(() => {
    if (!ctx.open || !ctx.triggerRef.current) return;

    const updatePosition = () => {
      const trigger = ctx.triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const content = ctx.contentRef.current;
      const height =
        content && content.offsetHeight > 0 ? content.offsetHeight : 320;
      const width =
        content && content.offsetWidth > 0 ? content.offsetWidth : 240;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const padding = 8;

      const availableBelow =
        viewportHeight - rect.bottom - sideOffset - padding;
      const availableAbove = rect.top - sideOffset - padding;

      let side: "bottom" | "top" = "bottom";
      let top = rect.bottom + sideOffset;

      if (availableBelow < height && availableAbove > availableBelow) {
        side = "top";
        top = rect.top - height - sideOffset;
      }

      if (top < padding) {
        top = padding;
      } else if (top + height > viewportHeight - padding) {
        top = Math.max(padding, viewportHeight - padding - height);
      }

      let left = rect.left;
      if (align === "center") {
        left = rect.left + rect.width / 2;
        if (left - width / 2 < padding) {
          left = padding + width / 2;
        } else if (left + width / 2 > viewportWidth - padding) {
          left = viewportWidth - padding - width / 2;
        }
      } else if (align === "end") {
        left = rect.right;
        if (left - width < padding) {
          left = Math.min(viewportWidth - padding, padding + width);
        } else if (left > viewportWidth - padding) {
          left = viewportWidth - padding;
        }
      } else {
        if (left + width > viewportWidth - padding) {
          left = Math.max(padding, viewportWidth - padding - width);
        }
        if (left < padding) {
          left = padding;
        }
      }

      setCoords({ top, left, side });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && ctx.contentRef.current) {
      ro = new ResizeObserver(() => {
        updatePosition();
      });
      ro.observe(ctx.contentRef.current);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      ro?.disconnect();
    };
  }, [ctx.open, ctx.triggerRef, ctx.contentRef, align, sideOffset]);

  // Move focus into the popover on open — keyboard users must land inside,
  // not stay on the trigger.
  React.useEffect(() => {
    const el = ctx.contentRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (first ?? el).focus({ preventScroll: true });
  }, []);

  const reduceMotion = useReducedMotion();

  const combinedRef = (node: HTMLDivElement | null): void => {
    (ctx.contentRef as React.MutableRefObject<HTMLDivElement | null>).current =
      node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  // Alignment offset lives in the motion transform (a Tailwind translate
  // class would be overwritten by the scale animation).
  const alignX = align === "center" ? "-50%" : align === "end" ? "-100%" : "0%";
  const currentSide = coords?.side ?? "bottom";
  const verticalOrigin = currentSide === "top" ? "bottom" : "top";
  const horizontalOrigin =
    align === "center" ? "center" : align === "end" ? "right" : "left";
  const origin = `${verticalOrigin} ${horizontalOrigin}`;

  return createPortal(
    <AnimatePresence>
      {ctx.open && (
        <motion.div
          ref={combinedRef}
          role="dialog"
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.97, x: alignX }}
          animate={{ opacity: 1, scale: 1, x: alignX }}
          exit={{
            opacity: 0,
            scale: 0.97,
            x: alignX,
            transition: reduceMotion ? { duration: 0 } : MORPH_EXIT,
          }}
          transition={reduceMotion ? { duration: 0 } : MORPH}
          style={{
            position: "fixed",
            top: coords ? `${coords.top}px` : "0px",
            left: coords ? `${coords.left}px` : "0px",
            visibility: coords ? "visible" : "hidden",
            zIndex: 50,
            transformOrigin: origin,
          }}
          className={cn(
            "z-50 w-auto max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-overlay outline-none",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
});
PopoverContent.displayName = "PopoverContent";
