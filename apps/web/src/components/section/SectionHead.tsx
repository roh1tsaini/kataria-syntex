import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

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
          "font-body text-[11px] font-bold uppercase tracking-[0.07em]",
          invert ? "text-sky" : "text-royal",
        )}
      >
        {kicker}
      </p>
      <Tag
        className={cn(
          "mt-3 font-display text-[clamp(1.75rem,3.5vw,2.375rem)] font-bold leading-[1.08] tracking-tight",
          invert ? "text-white" : "text-navy",
        )}
      >
        {title}
      </Tag>
      {lede ? (
        <p
          className={cn(
            "mt-4 max-w-xl text-base leading-relaxed",
            invert ? "text-ice-soft" : "text-ink-soft",
          )}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
