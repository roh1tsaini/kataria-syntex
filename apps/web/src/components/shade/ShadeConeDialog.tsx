"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, X } from "lucide-react";
import type { Shade } from "@/content/shades";
import { YarnCone } from "@/components/shade/YarnCone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shade cone dialog — clicking a shade opens it wound on a dye cone, the
 * way the reference product photo presents a single shade: white bobbin,
 * wound thread body, soft studio floor. The card speaks the site language
 * (paper surface, navy ink, royal action, mono codes, lifted shadow) so it
 * feels like the shade card opening up rather than a new page.
 */
export function ShadeConeDialog({
  shade,
  prev,
  next,
  onClose,
  onPrev,
  onNext,
}: {
  shade: Shade | null;
  prev: Shade | null;
  next: Shade | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open={shade !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-fade-zoom-in fixed inset-0 z-50 bg-navy/60 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          data-lenis-prevent
          aria-describedby={undefined}
          className="animate-fade-zoom-in fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-paper text-navy shadow-float outline-none"
        >
          {shade ? (
            <ConeBody
              key={shade.code}
              shade={shade}
              prev={prev}
              next={next}
              onPrev={onPrev}
              onNext={onNext}
            />
          ) : null}
          <DialogPrimitive.Close
            aria-label="Close shade preview"
            className="absolute right-4 top-4 cursor-pointer rounded-control p-2.5 text-navy transition-colors hover:bg-canvas hover:text-royal"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ConeBody({
  shade,
  prev,
  next,
  onPrev,
  onNext,
}: {
  shade: Shade;
  prev: Shade | null;
  next: Shade | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const colors = shade.colors ?? [shade.hex];

  /* Arrow-key walk across the visible grid while the dialog is open. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyHex = async () => {
    try {
      await navigator.clipboard.writeText(shade.hex.toUpperCase());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid sm:grid-cols-[1.05fr_1fr]">
      {/* Stage — studio floor with a tint of the shade itself */}
      <div
        className="relative flex items-center justify-center overflow-hidden bg-canvas px-6 pb-4 pt-10 sm:min-h-[480px] sm:pb-8"
        style={{
          backgroundImage: `radial-gradient(120% 90% at 50% 8%, ${shade.hex}2e 0%, transparent 55%), radial-gradient(closest-side at 50% 88%, rgb(10 37 64 / 0.10), transparent)`,
        }}
      >
        <span
          aria-hidden="true"
          className="tnum absolute left-4 top-4 rounded-[5px] border border-line bg-paper/95 px-2 py-1 font-mono text-[10px] font-medium tracking-wide text-navy shadow-card"
        >
          {shade.code}
        </span>
        {shade.colors ? (
          <span
            aria-hidden="true"
            className="absolute right-4 top-4 rounded-[5px] bg-navy px-2 py-1 font-body text-[10px] font-bold uppercase tracking-[0.07em] text-paper"
          >
            Melange
          </span>
        ) : null}
        <YarnCone
          colors={colors}
          hex={shade.hex}
          seed={shade.code}
          title={`Yarn cone wound in shade ${shade.code}`}
          className="h-[300px] w-auto sm:h-[380px]"
        />
        <p
          aria-hidden="true"
          className="tnum absolute bottom-3 left-0 right-0 text-center font-mono text-[10px] tracking-wide text-ink-soft/70"
        >
          CARD PAGE {shade.page}
        </p>
      </div>

      {/* Details */}
      <div className="flex flex-col p-6 sm:p-8">
        <DialogPrimitive.Title className="font-body text-[11px] font-bold uppercase tracking-[0.07em] text-royal">
          RAJ shade card · Page {shade.page}
        </DialogPrimitive.Title>
        <p className="mt-2 font-display text-[clamp(1.75rem,3.5vw,2.375rem)] font-bold leading-[1.08] tracking-tight">
          Shade {shade.code}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyHex}
            title="Copy hex to clipboard"
            className="tnum inline-flex cursor-pointer items-center gap-1.5 rounded-chip border border-line bg-paper px-2.5 py-1.5 font-mono text-xs text-navy transition-colors hover:border-royal hover:text-royal"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-3.5 text-success" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
            {copied ? "Copied" : shade.hex.toUpperCase()}
          </button>
          <span
            aria-hidden="true"
            title={colors.length > 1 ? colors.join(" · ") : undefined}
            className="inline-flex items-center gap-1 rounded-chip border border-line px-2 py-1.5"
          >
            {colors.map((color) => (
              <span
                key={color}
                style={{ backgroundColor: color }}
                className="size-3.5 rounded-full border border-navy/15"
              />
            ))}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Dyed embroidery yarn, wound the way the physical card carries it.{" "}
          {shade.colors
            ? "A melange thread — several colors carried in a single strand, wrapped here in sequence."
            : "A single dyed shade, lit the way the cone catches studio light."}
        </p>
        <p className="tnum mt-3 font-mono text-[11px] leading-relaxed text-ink-soft/80">
          SCREEN COLORS ARE INDICATIVE — PHYSICAL LOTS ARE MATCHED ON LAB DIPS.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild variant="primary">
            <Link href={`/contact?shade=${encodeURIComponent(shade.code)}`}>
              Request this shade
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={copyHex}
            className="border-line text-navy hover:border-royal hover:text-royal"
          >
            {copied ? (
              <Check aria-hidden="true" className="text-success" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Hex copied" : "Copy hex"}
          </Button>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-8">
          <PrevNextButton direction="prev" target={prev} onClick={onPrev} />
          <PrevNextButton direction="next" target={next} onClick={onNext} />
        </div>
        <p className="tnum mt-3 text-center font-mono text-[10px] text-ink-soft/60">
          ← → TO BROWSE · ESC TO CLOSE
        </p>
      </div>
    </div>
  );
}

function PrevNextButton({
  direction,
  target,
  onClick,
}: {
  direction: "prev" | "next";
  target: Shade | null;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!target}
      aria-label={
        target
          ? `View shade ${target.code}`
          : `No ${direction === "prev" ? "previous" : "next"} shade`
      }
      className={cn(
        "tnum inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-line px-3.5 font-mono text-xs text-navy transition-colors",
        target
          ? "hover:border-royal hover:text-royal"
          : "cursor-not-allowed opacity-40",
        direction === "next" && "flex-row-reverse",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {target ? target.code : "—"}
    </button>
  );
}
