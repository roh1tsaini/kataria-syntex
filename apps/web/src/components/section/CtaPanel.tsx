import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@kataria-syntex/shared";

/**
 * Closing CTA panel — a navy gradient tile with aurora glow and fiber
 * grain, floating on the light canvas. One question, one primary action.
 */
export function CtaPanel({
  kicker,
  title,
  lede,
  actions,
  align = "left",
}: {
  kicker: string;
  title: string;
  lede: string;
  actions: ReactNode;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <Reveal
      className={cn(
        "relative overflow-hidden rounded-hero border border-line-dark bg-navy shadow-float",
        centered ? "px-6 py-16 text-center md:p-20" : "p-8 md:p-14",
      )}
    >
      <div aria-hidden="true" className="absolute inset-0 ks-aurora-dark" />
      <div
        aria-hidden="true"
        className="absolute inset-0 ks-noise opacity-[0.14] mix-blend-overlay"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-sky/50 to-transparent"
      />
      <div
        className={cn("relative", centered ? "mx-auto max-w-2xl" : "max-w-2xl")}
      >
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.07em] text-sky">
          {kicker}
        </p>
        <h2 className="mt-4 text-balance font-display text-[clamp(1.875rem,3.8vw,2.875rem)] font-bold leading-[1.05] tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-4 text-pretty text-base leading-relaxed text-ice-soft">
          {lede}
        </p>
        <div
          className={cn(
            "mt-8 flex flex-wrap gap-3",
            centered && "justify-center",
          )}
        >
          {actions}
        </div>
      </div>
    </Reveal>
  );
}
