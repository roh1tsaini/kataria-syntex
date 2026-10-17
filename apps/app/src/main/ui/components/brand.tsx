import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { cn } from "@/ui/lib/cn";

/** K mark tile — foreground square, background initials. */
export function BrandMark({
  label = "K",
  size = "md",
}: {
  label?: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center bg-foreground text-background",
        size === "lg" ? "size-11 rounded-xl" : "size-8 rounded-md",
      )}
    >
      <span
        className={cn(
          "font-semibold leading-none",
          size === "lg" ? "text-lg tracking-tight" : "text-[11px]",
        )}
        aria-hidden
      >
        {label}
      </span>
    </div>
  );
}

/** One-line lockup — mark + product name (auth, download). */
export function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size="lg" />
      <div className="text-[17px] font-semibold tracking-tight">
        {COMPANY_DETAILS.name} Biz App
      </div>
    </div>
  );
}
