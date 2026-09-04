import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT, staggerContainer, staggerItem } from "@/ui/lib/motion";

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

/** Stat display with tabular numbers. */
export function CountUp({
  target,
  format,
  className,
}: {
  target: number;
  format?: (value: number) => string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {format ? format(target) : Math.round(target).toLocaleString("en-IN")}
    </span>
  );
}
