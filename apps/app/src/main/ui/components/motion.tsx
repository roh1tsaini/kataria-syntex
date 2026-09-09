import { memo, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/ui/lib/cn";
import {
  EASE_OUT,
  SPRING,
  staggerContainer,
  staggerItem,
} from "@/ui/lib/motion";

/** Single element entrance container. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 6,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Parent container with staggered child entrances. */
export function Stagger({
  children,
  className,
  stagger = 0.04,
  delay = 0.01,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={staggerContainer(stagger, delay)}
    >
      {children}
    </motion.div>
  );
}

/** Staggered child item. */
export function StaggerItem({
  children,
  className,
  variants = staggerItem,
}: {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

/** Route-level enter/exit transition, driven by AnimatePresence in AppShell. */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reduce ? 0 : 4,
        transition: { duration: reduce ? 0 : 0.13, ease: EASE_OUT },
      }}
      transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Clean, lightweight shimmering placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted/70", className)}
      aria-hidden
    />
  );
}

/**
 * Shared 0–9 cells — one constant, never re-created or reconciled.
 */
const ROLL_CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
  <span key={d} className="h-[1em] shrink-0 leading-[1em]">
    {d}
  </span>
));

/**
 * One rolling digit: a 0–9 strip that slides to the target digit.
 * em-sized so it inherits whatever stat size surrounds it. Mounts at zero
 * so first appearance counts up instead of snapping in. Transform-only +
 * memoized so the frame loop stays at the device refresh rate (60/90/120Hz,
 * no cap — rAF is vsync-synced).
 */
const RollingDigit = memo(function RollingDigit({
  digit,
  pos,
}: {
  digit: number;
  pos: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-block h-[1em] w-[1ch] overflow-hidden text-center align-top"
    >
      <motion.span
        className="flex flex-col"
        style={{ willChange: "transform" }}
        initial={{ y: "0em" }}
        animate={{ y: `${-digit}em` }}
        transition={{ ...SPRING, delay: Math.min(pos * 0.03, 0.12) }}
      >
        {ROLL_CELLS}
      </motion.span>
    </span>
  );
});

/**
 * Stat display with rolling digits. The formatted string is split per
 * character: digits roll, separators/symbols (commas, decimals, ₹) stay
 * fixed. Digits key from the units side so a value change rolls the same
 * column instead of remounting it. Display only — never inside inputs.
 */
export function CountUp({
  target,
  format,
  className,
}: {
  target: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const text = format
    ? format(target)
    : Math.round(target).toLocaleString("en-IN");
  if (reduceMotion) {
    return <span className={cn("tabular-nums", className)}>{text}</span>;
  }
  const chars = [...text];
  // Digit position from the right (units = 0) — stable across regroupings.
  const posFromRight: number[] = [];
  let seen = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    posFromRight[i] = /\d/.test(chars[i]) ? seen++ : -1;
  }
  return (
    <span
      className={cn("tabular-nums", className)}
      role="status"
      aria-label={text}
    >
      <span aria-hidden>
        {chars.map((ch, i) =>
          /\d/.test(ch) ? (
            <RollingDigit
              key={`d${posFromRight[i]}`}
              digit={Number(ch)}
              pos={posFromRight[i]}
            />
          ) : (
            <span key={`s${i}-${ch}`} className="inline-block">
              {ch === " " ? " " : ch}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
