import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@kataria-syntex/shared";

/**
 * Section heading block — a kicker, a display-size title, and an
 * optional lede. Used to open every major section.
 */
export function SectionHead({
  kicker,
  title,
  lede,
  className,
  invert = false,
  /** Page-opening heads render as h1; in-section heads stay h2. */
  as: Tag = "h2",
}: {
  kicker: string;
  title: string;
  lede?: string;
  className?: string;
  invert?: boolean;
  as?: "h1" | "h2";
}) {
  return (
    <Reveal className={cn("max-w-3xl", className)}>
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
        {kicker}
      </p>
      <Tag
        className={cn(
          "mt-4 text-balance font-display text-[clamp(1.875rem,3.6vw,2.625rem)] font-bold leading-[1.06] tracking-tight",
          invert ? "text-white" : "text-navy",
        )}
      >
        {title}
      </Tag>
      {lede ? (
        <p
          className={cn(
            "mt-4 max-w-xl text-pretty text-base leading-relaxed",
            invert ? "text-ice-soft" : "text-ink-soft",
          )}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
