import * as React from "react";
import { cn } from "@kataria-syntex/shared";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full resize-y rounded-control border border-line bg-paper px-3.5 py-2.5 text-sm text-navy shadow-xs transition-[border-color,box-shadow] duration-200 placeholder:text-ink-soft/60",
        "focus:border-royal focus:shadow-[0_0_0_3px_rgb(30_58_138/0.12)] focus:outline-none aria-invalid:border-danger aria-invalid:shadow-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
