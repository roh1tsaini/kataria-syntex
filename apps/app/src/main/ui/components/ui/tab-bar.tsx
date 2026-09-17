import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { SPRING } from "@/ui/lib/motion";
import { cn } from "@/ui/lib/cn";

export interface TabBarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface TabBarProps {
  items: TabBarItem[];
  pathname: string;
  onMore: () => void;
  /** Hidden while a full-screen surface (nav drawer) covers it. */
  hidden?: boolean;
}

const isEditable = (el: Element | null): boolean =>
  el instanceof HTMLElement &&
  (el.matches("input, textarea, select") || el.isContentEditable);

export function TabBar({ items, pathname, onMore, hidden }: TabBarProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  // Icon pop answers selection (§2.7.2) — null means "never yet", so the
  // initial mount never pulses.
  const [popKey, setPopKey] = useState<number | null>(null);
  const active = items.findIndex((item) =>
    item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  const activeKey = items[active]?.to ?? "more";
  const [previousActive, setPreviousActive] = useState(activeKey);
  if (previousActive !== activeKey) {
    setPreviousActive(activeKey);
    setPopKey((key) => (key ?? 0) + 1);
  }

  useEffect(() => {
    const update = () => setEditing(isEditable(document.activeElement));
    // The next target keeps the bar hidden when focus moves between fields.
    const onFocusOut = (event: FocusEvent) => {
      setEditing(
        isEditable(
          event.relatedTarget instanceof Element ? event.relatedTarget : null,
        ),
      );
    };
    update();
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const selection = (
    <motion.span
      aria-hidden
      layoutId={reduceMotion ? undefined : "selection"}
      initial={false}
      transition={reduceMotion ? { duration: 0 } : SPRING}
      className="absolute inset-0 rounded-full bg-primary"
      style={{ borderRadius: 999 }}
    />
  );
  const itemClass =
    "btn-motion relative grid size-11 shrink-0 place-items-center rounded-full active:bg-muted active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
  const popClass =
    reduceMotion || popKey === null
      ? undefined
      : "animate-[tab-pop_260ms_var(--ease-morph)]";

  return (
    <nav
      aria-label="Quick navigation"
      className={cn(
        "phone-navigation pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center md:hidden",
        (editing || hidden) && "invisible",
      )}
    >
      <LayoutGroup id={id}>
        <div className="capsule-surface pointer-events-auto flex items-center gap-1 rounded-full border border-border p-1">
          {items.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              aria-current={active === index ? "page" : undefined}
              className={cn(
                itemClass,
                active === index
                  ? "text-primary-foreground"
                  : "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
              )}
            >
              {active === index && selection}
              <item.icon
                key={active === index ? `pop-${popKey}` : "idle"}
                className={cn("relative size-5", active === index && popClass)}
                aria-hidden
              />
            </Link>
          ))}
          <button
            type="button"
            onClick={onMore}
            aria-label="More navigation"
            aria-haspopup="dialog"
            aria-expanded={false}
            title="More navigation"
            className={cn(
              itemClass,
              active < 0
                ? "text-primary-foreground"
                : "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
            )}
          >
            {active < 0 && selection}
            <Ellipsis
              key={active < 0 ? `pop-${popKey}` : "idle"}
              className={cn("relative size-5", active < 0 && popClass)}
              aria-hidden
            />
          </button>
        </div>
      </LayoutGroup>
    </nav>
  );
}
