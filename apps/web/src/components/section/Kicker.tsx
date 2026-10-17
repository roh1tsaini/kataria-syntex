import { cn } from "@kataria-syntex/shared";

/**
 * Kicker — the hairline rule + uppercase label that opens PageHead (pages)
 * and SectionHead (sections).
 */
export function Kicker({
  children,
  invert = false,
}: {
  children: string;
  invert?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.07em]",
        invert ? "text-sky" : "text-royal",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-px w-8", invert ? "bg-sky/50" : "bg-royal/40")}
      />
      {children}
    </p>
  );
}
