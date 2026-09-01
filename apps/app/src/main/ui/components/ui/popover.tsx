import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/ui/lib/cn";

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
  React.HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "center" | "end";
    sideOffset?: number;
  }
>(({ className, align = "start", sideOffset = 4, children, ...props }, ref) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverContent must be used inside Popover");

  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    if (!ctx.open || !ctx.triggerRef.current) return;

    const updatePosition = () => {
      const trigger = ctx.triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();

      let top = rect.bottom + sideOffset;
      let left = rect.left;

      if (align === "center") {
        left = rect.left + rect.width / 2;
      } else if (align === "end") {
        left = rect.right;
      }

      // Flip above if close to bottom
      const viewportHeight = window.innerHeight;
      if (top + 340 > viewportHeight && rect.top - 340 > 0) {
        top = rect.top - sideOffset;
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [ctx.open, ctx.triggerRef, align, sideOffset]);

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

  if (!ctx.open) return null;

  const combinedRef = (node: HTMLDivElement | null) => {
    (ctx.contentRef as React.MutableRefObject<HTMLDivElement | null>).current =
      node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const alignClass =
    align === "center"
      ? "-translate-x-1/2"
      : align === "end"
        ? "-translate-x-full"
        : "";

  return createPortal(
    <div
      ref={combinedRef}
      role="dialog"
      tabIndex={-1}
      style={{
        position: "fixed",
        top: coords ? `${coords.top}px` : "0px",
        left: coords ? `${coords.left}px` : "0px",
        visibility: coords ? "visible" : "hidden",
        zIndex: 50,
      }}
      className={cn(
        "z-50 w-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-overlay outline-none transition-all duration-150 animate-in fade-in-0 zoom-in-95",
        alignClass,
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
});
PopoverContent.displayName = "PopoverContent";
