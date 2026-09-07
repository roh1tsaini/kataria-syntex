import * as React from "react";
import { cn } from "@kataria-syntex/shared";

const badgeClassName =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-ice/40 font-body text-[11px] font-bold uppercase tracking-[0.07em] text-navy px-2.5 py-1";

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeClassName, className)}
      {...props}
    />
  );
}

export { Badge };
