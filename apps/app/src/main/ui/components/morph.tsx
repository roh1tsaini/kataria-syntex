import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/ui/lib/cn";
import { MORPH, MORPH_EXIT } from "@/ui/lib/motion";

/**
 * Morph panel (design.md §5.6): the video's pattern — a collapsed row that
 * springs into its expanded card and back. The summary row stays mounted as
 * the header (it stays the collapse control); the body grows in beneath it.
 * One panel per group is open at a time (MorphGroup); exits mirror entries
 * ~20% faster. The height change is measured and transform-corrected by
 * motion, satisfying §5 rule 1 — never a raw CSS height tween.
 */

type MorphGroupContextType = {
  openId: string | null;
  toggle: (id: string) => void;
};

const MorphGroupContext = createContext<MorphGroupContextType | null>(null);

/** One-open-per-group. Standalone MorphPanels (no group) toggle alone. */
export function MorphGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);
  return (
    <MorphGroupContext.Provider value={{ openId, toggle }}>
      <div className={className}>{children}</div>
    </MorphGroupContext.Provider>
  );
}

export function MorphPanel({
  id,
  summary,
  children,
  className,
  summaryClassName,
  contentClassName,
}: {
  /** Stable identity within the group (drives which panel is open). */
  id: string;
  /** Always-visible header row — also the collapse control. */
  summary: ReactNode;
  /** Expanded-only content, revealed beneath the header. */
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
}) {
  const group = useContext(MorphGroupContext);
  const open = group ? group.openId === id : false;
  const toggle = group?.toggle;
  const [selfOpen, setSelfOpen] = useState(false);
  const isOpen = toggle ? open : selfOpen;

  const onToggle = useCallback(() => {
    if (toggle) toggle(id);
    else setSelfOpen((prev) => !prev);
  }, [toggle, id]);

  const reduce = useReducedMotion();

  return (
    <motion.div
      layout
      transition={isOpen ? MORPH : MORPH_EXIT}
      className={cn(
        "overflow-hidden bg-card shadow-soft",
        isOpen && "shadow-lift",
        className,
      )}
      style={{ borderRadius: isOpen ? "1rem" : "0.75rem" }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none",
          "transition-colors duration-150 [@media(hover:hover)]:hover:bg-muted/40",
          summaryClassName,
        )}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <motion.span
          aria-hidden
          className="shrink-0 text-muted-foreground"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : MORPH}
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: reduce ? 1 : 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: reduce ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : MORPH}
            className="overflow-hidden"
          >
            <div className={cn("px-4 pb-4", contentClassName)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
