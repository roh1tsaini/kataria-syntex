import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The rounded filter pill used by the product and shade-card filters. */
export function FilterPill({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-11 cursor-pointer rounded-full px-5 font-body text-sm font-semibold transition-colors",
        active
          ? "bg-royal text-white"
          : "border border-line bg-paper text-ink-soft hover:border-royal hover:text-royal",
        className,
      )}
    >
      {children}
    </button>
  );
}
