import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT, staggerContainer, staggerItem } from "@/ui/lib/motion";

/** Parent container with staggered child entrances. */
export function Stagger({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;

  return (
    <motion.div initial="hidden" animate="show" variants={staggerContainer()}>
      {children}
    </motion.div>
  );
}

/** Staggered child item. */
export function StaggerItem({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;

  return <motion.div variants={staggerItem}>{children}</motion.div>;
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
