import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/ui/lib/cn";

type MorphPanelProps = Omit<
  React.ComponentProps<"div">,
  "aria-hidden" | "children" | "inert"
> & {
  open: boolean;
  children: React.ReactNode;
};

/** Shared expanding panel: one height, opacity, timing, and focus contract. */
export function MorphPanel({
  open,
  className,
  children,
  ...props
}: MorphPanelProps) {
  return (
    <div
      {...props}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid grid-rows-[0fr] opacity-0 morph-grid",
        open && "grid-rows-[1fr] opacity-100 morph-open",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function MorphChevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <ChevronDown
      className={cn(
        "morph-transform",
        open && "rotate-180 morph-open",
        className,
      )}
      aria-hidden
    />
  );
}

export function MorphPlusMinus({ open }: { open: boolean }) {
  return (
    <span className="relative grid size-3 place-items-center" aria-hidden>
      <span className="absolute h-px w-3 rounded-full bg-current" />
      <span
        className={cn(
          "absolute h-3 w-px rounded-full bg-current morph-transform",
          open && "scale-y-0 morph-open",
        )}
      />
    </span>
  );
}
