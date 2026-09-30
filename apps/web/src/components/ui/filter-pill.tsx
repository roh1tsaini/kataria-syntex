import type { ReactNode } from "react";
import { cn } from "@kataria-syntex/shared";

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
        "h-11 cursor-pointer rounded-full px-5 text-sm font-semibold transition-[background-color,color,border-color,box-shadow] duration-200 ease-[var(--ease-out)] active:scale-[0.97]",
        active
          ? "bg-royal text-white shadow-button"
          : "border border-line bg-paper text-ink-soft shadow-xs hover:border-royal/40 hover:text-royal",
        className,
      )}
    >
      {children}
    </button>
  );
}
