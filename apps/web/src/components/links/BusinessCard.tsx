"use client";

import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Camera,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { CardLink } from "@/content/links";
import type { OpenStatus } from "@/lib/hours";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";

const ICONS: Record<CardLink["icon"], LucideIcon> = {
  globe: Globe,
  whatsapp: MessageCircle,
  phone: Phone,
  pin: MapPin,
  instagram: Camera,
  facebook: ThumbsUp,
};

type BusinessCardProps = {
  name: string;
  tagline: string;
  meta: readonly { term: string; value: string }[];
  status: OpenStatus;
  links: CardLink[];
};

/**
 * The /links digital business card — a print-twin of the physical card:
 * navy front (mark, name, tagline, live status dot) and a static ice
 * back carrying the contact ledger, followed by the direct link rows.
 *
 * Motion, all delta-time rAF and transform/opacity only: the front card
 * tilts toward the pointer on a damped spring, glides back with a soft
 * wobble on release, compresses slightly under a press, and drifts
 * almost imperceptibly when untouched. Rows answer hover/touch with a
 * label slide, an arrow nudge, and a short content glide. Everything
 * pauses offscreen and on hidden tabs, and is omitted under
 * prefers-reduced-motion.
 */
export function BusinessCard({
  name,
  tagline,
  meta,
  status,
  links,
}: BusinessCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const target = useRef({ rx: 0, ry: 0, s: 1, active: false });

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;

    let raf = 0;
    let last = performance.now();
    let inView = true;
    let pageVisible = !document.hidden;

    let rx = 0;
    let ry = 0;
    let s = 1;
    let vrx = 0;
    let vry = 0;
    let vs = 0;
    let driftClock = 0;
    let autoBlend = 1;

    // Touch devices have no hover — there the card carries a smooth,
    // continuous auto-motion instead of the desktop's subtle drift.
    const touchLike = window.matchMedia(
      "(hover: none), (pointer: coarse)",
    ).matches;

    const spring = (
      value: number,
      velocity: number,
      goal: number,
      stiffness: number,
      damping: number,
      dt: number,
    ): [number, number] => {
      const nextVelocity =
        velocity + (-stiffness * (value - goal) - damping * velocity) * dt;
      return [value + nextVelocity * dt, nextVelocity];
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (inView && pageVisible) {
        const t = target.current;
        const stiffness = t.active ? 170 : 90;
        const damping = t.active ? 20 : 6.5;

        // Auto-motion blends out while a finger/mouse drives the card and
        // back in on release; the clock never stops, so the path stays
        // continuous and the glide never jumps.
        autoBlend += ((t.active ? 0 : 1) - autoBlend) * Math.min(dt * 3, 1);
        driftClock += dt;

        let goalX = t.rx;
        let goalY = t.ry;
        let floatY = 0;
        if (touchLike) {
          goalX +=
            autoBlend *
            (Math.sin(driftClock * 0.42) * 2.2 +
              Math.sin(driftClock * 0.17) * 0.7);
          goalY +=
            autoBlend *
            (Math.cos(driftClock * 0.31) * 2.8 +
              Math.cos(driftClock * 0.19) * 0.9);
          floatY = autoBlend * Math.sin(driftClock * 0.55) * 2.5;
        } else {
          goalX += autoBlend * Math.sin(driftClock * 0.45) * 0.7;
          goalY += autoBlend * Math.cos(driftClock * 0.38) * 0.9;
        }

        [rx, vrx] = spring(rx, vrx, goalX, stiffness, damping, dt);
        [ry, vry] = spring(ry, vry, goalY, stiffness, damping, dt);
        [s, vs] = spring(s, vs, t.s, 220, 26, dt);
        card.style.transform = `translate3d(0, ${floatY.toFixed(2)}px, 0) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${s.toFixed(4)})`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    observer.observe(root);

    const onVisibility = () => {
      pageVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reducedMotion]);

  const updatePointer = (clientX: number, clientY: number) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const t = target.current;
    t.active = true;
    t.ry = (px - 0.5) * 9;
    t.rx = (0.5 - py) * 7;
  };

  const releasePointer = () => {
    const t = target.current;
    t.active = false;
    t.rx = 0;
    t.ry = 0;
    t.s = 1;
  };

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center px-4 py-12 xs:py-16"
    >
      <Reveal>
        <div className="mb-5 flex items-center gap-3">
          <span
            className="size-2 flex-none rounded-[3px] bg-gradient-to-br from-royal to-sky"
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            {name} — card
          </span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        {/* Front */}
        <div className="[perspective:1200px]">
          <div
            ref={cardRef}
            className="group/card relative flex aspect-[7/4] flex-col overflow-hidden rounded-card bg-navy p-5 text-paper shadow-float will-change-transform"
            onPointerMove={(event) =>
              updatePointer(event.clientX, event.clientY)
            }
            onPointerDown={(event) => {
              target.current.s = 0.982;
              updatePointer(event.clientX, event.clientY);
            }}
            onPointerUp={() => {
              target.current.s = 1;
            }}
            onPointerLeave={releasePointer}
            onPointerCancel={releasePointer}
          >
            <div className="flex items-center justify-between gap-4">
              <span
                aria-hidden="true"
                className="size-3 flex-none rounded-[4px] bg-gradient-to-br from-royal to-sky"
              />
              <span className="tnum flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ice-soft">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 flex-none rounded-full ${status.open ? "animate-pulse bg-sky" : "bg-danger"}`}
                />
                {status.label}
              </span>
            </div>

            <h1 className="mt-3 whitespace-nowrap font-display text-[1.65rem] font-bold leading-none tracking-tight text-white xs:text-[1.85rem]">
              {name.toUpperCase()}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-sky">{tagline}</p>

            <div className="mt-auto border-t border-line-dark pt-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ice-soft/60">
              Yarn sourcing · {COMPANY_DETAILS.location.split(",")[0]}
            </div>
          </div>
        </div>

        {/* Back — static ice panel with the contact ledger */}
        <div className="mt-4 rounded-card border border-line bg-ice/60 p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[10px]">
            {meta.map((item) => (
              <div key={item.term} className="min-w-0">
                <dt className="uppercase tracking-[0.12em] text-navy/60">
                  {item.term}
                </dt>
                <dd className="tnum mt-0.5 truncate text-navy">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mb-2 mt-10 flex items-center gap-3">
          <span className="h-px w-4 flex-none bg-line" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Reach the desk
          </span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <nav aria-label="Contact links">
          <ul className="border-b border-line">
            {links.map((link, index) => {
              const Icon = ICONS[link.icon];
              return (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group relative flex items-center gap-4 overflow-hidden border-t border-line py-[1.05rem]"
                  >
                    <span className="tnum w-6 flex-none pt-1 font-mono text-[11px] text-ink-soft/60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-3 transition-transform duration-200 ease-out group-hover:translate-x-1.5 group-active:translate-x-1.5">
                      <Icon
                        aria-hidden="true"
                        className="h-[15px] w-[15px] flex-none text-ink-soft"
                        strokeWidth={1.5}
                      />
                      <span className="min-w-0">
                        <span className="relative block overflow-hidden font-display text-[1.3rem] font-bold leading-[1.05] tracking-tight text-navy xs:text-[1.45rem]">
                          <span className="block transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-full group-active:-translate-y-full">
                            {link.label}
                          </span>
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 block translate-y-full text-royal transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-active:translate-y-0"
                          >
                            {link.label}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-ink-soft/80">
                          {link.detail}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 flex-none text-ink-soft transition-[transform,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-royal"
                      strokeWidth={1.5}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft/70">
          {tagline.replace(/\.$/, "")}
        </div>
      </Reveal>
    </div>
  );
}
