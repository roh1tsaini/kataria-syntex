/**
 * WEB ONLY — blue brand design system (navy/royal/sky/ice, see design.md).
 * Do NOT copy to apps/app — app uses the Luma system (oklch accents).
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@kataria-syntex/shared";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control font-body text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-royal text-white shadow-button hover:bg-navy hover:shadow-[0_10px_24px_-8px_rgb(10_37_64/0.6)]",
        "on-dark":
          "bg-sky text-navy shadow-[0_8px_20px_-8px_rgb(125_211_252/0.45)] hover:bg-white",
        ghost: "border-[1.5px] border-current bg-transparent",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
