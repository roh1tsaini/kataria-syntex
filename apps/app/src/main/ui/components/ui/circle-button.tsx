import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/ui/lib/cn";

/* design.md §2.7 — a lone small icon button is a circle; adjacent ones join
   inside a ButtonCapsule. Shell chrome only; nav rows stay rounded-md. */
const circleButtonVariants = cva(
  "grid shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground outline-none transition-[background-color,color,border-color,transform] duration-150 ease-[var(--ease-out)] [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        md: "size-8 [&_svg]:size-4",
        touch: "size-11 [&_svg]:size-5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface CircleButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof circleButtonVariants> {
  /** When true, renders as the child element (e.g. a menu trigger). */
  asChild?: boolean;
}

export const CircleButton = React.forwardRef<
  HTMLButtonElement,
  CircleButtonProps
>(({ className, size, asChild = false, type = "button", ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={type}
      className={cn(circleButtonVariants({ size, className }))}
      {...props}
    />
  );
});
CircleButton.displayName = "CircleButton";

/** Capsule that joins adjacent CircleButtons into one cluster. */
export function ButtonCapsule({
  vertical = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { vertical?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-muted/60 p-1",
        vertical && "flex-col",
        className,
      )}
      {...props}
    />
  );
}
