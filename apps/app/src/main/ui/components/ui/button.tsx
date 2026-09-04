/**
 * APP ONLY — Luma design system (oklch accents, dark mode, skeleton loading).
 * Do NOT copy to apps/web — web uses Living Weave (ecru/ink/stitch).
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Skeleton } from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background [@media(hover:hover)]:hover:bg-foreground/90",
        accent:
          "bg-primary text-primary-foreground [@media(hover:hover)]:hover:bg-primary/90",
        outline:
          "border border-border bg-card [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [@media(hover:hover)]:hover:bg-secondary/80",
        ghost:
          "[@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground [@media(hover:hover)]:hover:bg-destructive/90",
        link: "text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 sm:h-10 touch-44",
        sm: "h-11 px-3 text-[13px] sm:h-8 touch-44",
        lg: "h-11 px-6 sm:h-11",
        icon: "size-11 sm:size-10 touch-44",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** When true, renders as the child element (e.g. react-router Link). */
  asChild?: boolean;
  /** Shows a skeleton pill and disables the button while truthy. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      type = "button",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <Skeleton
                className="h-4 w-14 rounded-full bg-primary-foreground/40"
                data-icon="inline-start"
                aria-hidden
              />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
