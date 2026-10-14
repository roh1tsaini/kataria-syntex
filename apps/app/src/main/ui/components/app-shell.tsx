import {
  type ReactNode,
  createContext,
  useContext,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Building2,
  LayoutGrid,
  List,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Sun,
  X,
} from "lucide-react";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { ButtonCapsule, CircleButton } from "@/ui/components/ui/circle-button";
import { MorphChevron, MorphPanel } from "@/ui/components/ui/disclosure";
import { TabBar, type TabBarItem } from "@/ui/components/ui/tab-bar";
import { Avatar, AvatarFallback } from "@/ui/components/ui/avatar";
import { PageTransition } from "@/ui/components/motion";
import { routeSkeleton } from "@/ui/components/page-skeletons";
import { OfflineBanner } from "@/ui/components/offline-banner";
import { useTheme } from "@/ui/hooks/use-theme";
import { useAuth, useNetworkState } from "@kataria-syntex/app-core";
import {
  isItemActive,
  isSubActive,
  SECTIONS,
  SIDEBAR_STORAGE_KEY,
  type NavSection,
} from "@/ui/components/nav-config";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT, EASE_DRAWER, MORPH, MORPH_EXIT } from "@/ui/lib/motion";
import {
  readNavDensity,
  writeNavDensity,
  type NavDensity,
} from "@/ui/lib/nav-prefs";
import { dragStyle, noDragStyle } from "@/ui/components/title-bar";

/** List/Grid switch — the one control that changes how the nav itself reads.
 *  Two or more adjacent icon buttons share one capsule (design.md Section 2.7). */
function NavDensityToggle({
  value,
  onChange,
}: {
  value: NavDensity;
  onChange: (next: NavDensity) => void;
}) {
  const options: { value: NavDensity; label: string; Icon: typeof List }[] = [
    { value: "list", label: "List", Icon: List },
    { value: "grid", label: "Grid", Icon: LayoutGrid },
  ];
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted/60 p-1 shadow-[var(--specular)]">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          title={`${label} layout`}
          aria-label={`${label} layout`}
          className={cn(
            "btn-motion grid size-9 place-items-center rounded-full",
            value === v
              ? "bg-card text-foreground shadow-[var(--shadow-soft)]"
              : "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background"
        title={`${COMPANY_DETAILS.name} Biz App`}
      >
        <span className="text-[11px] font-semibold leading-none" aria-hidden>
          KS
        </span>
      </div>
    );
  }
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5 px-1">
      <div className="relative grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background">
        <span className="text-[11px] font-semibold leading-none" aria-hidden>
          K
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-success ring-2 ring-card" />
      </div>
      <div className="min-w-0 overflow-hidden leading-tight">
        <div className="flex items-center gap-1 truncate text-[13px] font-semibold tracking-tight">
          <span>KS</span>
          <span className="font-medium text-muted-foreground">Biz App</span>
        </div>
        <div className="truncate text-[11px] font-normal text-muted-foreground">
          {COMPANY_DETAILS.name}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-3">
      <span className="select-none micro-label">{children}</span>
    </div>
  );
}

/** Expanded sidebar navigation with collapsible groups. */
function NavList({
  idPrefix,
  sections,
  expanded,
  onToggleGroup,
  pathname,
  search,
  onNavigate,
  density = "list",
}: {
  idPrefix: string;
  sections: NavSection[];
  expanded: Record<string, boolean>;
  onToggleGroup: (to: string) => void;
  pathname: string;
  search: string;
  onNavigate?: () => void;
  density?: NavDensity;
}) {
  const rowCls = "app-nav-row";
  const iconCls = "size-4";
  const chevronCls = "size-3.5";
  const subDotCls = "size-1";
  const grid = density === "grid";

  // Grid tiles are a fixed shape, so a group with sub-items does not tile —
  // it keeps the list rendering and carries its children underneath.
  const itemsCls = grid ? "grid grid-cols-2 gap-2" : "flex flex-col gap-0.5";
  const sectionCls = grid ? "flex flex-col gap-2" : "flex flex-col gap-0.5";

  return (
    <nav
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]",
        grid ? "px-3 py-3" : "px-3 py-3",
      )}
    >
      {sections.map((section, i) => (
        <div key={section.title} className={cn(i > 0 && "mt-3")}>
          <SectionLabel>{section.title}</SectionLabel>
          <div className={itemsCls}>
            {section.items.map((item) => {
              const active = isItemActive(item, pathname);
              const hasSubs = !!item.subItems?.length;
              const asTile = grid && !hasSubs;
              const panelId = `${idPrefix}-nav-group-${encodeURIComponent(item.to)}`;
              const anySubActive =
                item.subItems?.some((sub) =>
                  isSubActive(sub, pathname, search),
                ) ?? false;
              const isExpanded = expanded[item.to] ?? anySubActive;

              return (
                <div key={item.to}>
                  {hasSubs ? (
                    <button
                      type="button"
                      onClick={() => onToggleGroup(item.to)}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      className={cn(
                        "btn-motion flex w-full items-center",
                        rowCls,
                        anySubActive
                          ? "font-medium text-foreground"
                          : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(iconCls, "shrink-0")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {item.label}
                      </span>
                      <MorphChevron
                        open={isExpanded}
                        className={cn(
                          chevronCls,
                          "-rotate-90 shrink-0 opacity-60",
                          isExpanded && "rotate-0",
                        )}
                      />
                    </button>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={cn(
                        asTile
                          ? "btn-motion flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-3 text-center text-[13px] [@media(hover:hover)]:hover:bg-muted"
                          : "btn-motion flex items-center",
                        asTile ? null : rowCls,
                        active && asTile
                          ? "border-foreground bg-accent text-accent-foreground"
                          : "",
                        active && !asTile
                          ? "bg-accent font-medium text-accent-foreground"
                          : "",
                        !asTile &&
                          "text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(
                          asTile ? "size-5 shrink-0" : iconCls,
                          "shrink-0",
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          asTile
                            ? "line-clamp-2 leading-snug"
                            : "min-w-0 flex-1 truncate",
                        )}
                      >
                        {item.label}
                      </span>
                    </NavLink>
                  )}
                  {hasSubs && (
                    <MorphPanel id={panelId} open={isExpanded}>
                      <div
                        className={cn(
                          "flex flex-col gap-0.5 border-l border-border pl-3 pt-0.5",
                          "ml-4",
                        )}
                      >
                        {item.subItems?.map((sub) => {
                          const subActive = isSubActive(sub, pathname, search);
                          return (
                            <NavLink
                              key={sub.to}
                              to={sub.to}
                              onClick={onNavigate}
                              className={cn(
                                "app-nav-subrow btn-motion",
                                subActive
                                  ? "bg-accent font-medium text-accent-foreground"
                                  : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/60 [@media(hover:hover)]:hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  subDotCls,
                                  "shrink-0 rounded-full",
                                  subActive
                                    ? "bg-accent-foreground"
                                    : "bg-muted-foreground/40",
                                )}
                                aria-hidden
                              />
                              <span className="truncate">{sub.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </MorphPanel>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Nav filter for the desktop sidebar. Typing narrows the nav list in place;
 *  an empty query shows everything, and Escape clears the field. */
function NavSearch({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="shrink-0 px-3 pt-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.stopPropagation();
              onChange("");
            }
          }}
          placeholder="Search"
          aria-label="Search navigation"
          className={cn(
            "h-8 w-full rounded-md border border-transparent bg-muted pl-9 pr-12 text-[13px]",
            "text-foreground placeholder:text-muted-foreground",
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[5px] border border-border bg-card px-1.5 py-px text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}

/** Collapsed desktop rail: icons only, tooltips via title. */
function NavRail({
  sections,
  pathname,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2 [scrollbar-width:none]">
      {sections
        .flatMap((s) => s.items)
        .map((item) => {
          const active =
            isItemActive(item, pathname) ||
            (item.subItems?.some((sub) =>
              isSubActive(sub, pathname, window.location.search),
            ) ??
              false);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "btn-motion grid size-10 shrink-0 place-items-center rounded-md touch-44",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
            </NavLink>
          );
        })}
    </nav>
  );
}

function UserFooter({ compact }: { compact?: boolean }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/auth", { replace: true });
    } catch {
      // Local session state is already torn down by the store; stay put.
    } finally {
      setLoggingOut(false);
    }
  };

  if (compact) {
    return (
      <div className="flex justify-center border-t border-border py-2">
        <ButtonCapsule vertical>
          <CircleButton
            onClick={toggleTheme}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
            aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </CircleButton>
          <CircleButton
            onClick={() => void onLogout()}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
            className="[@media(hover:hover)]:hover:text-destructive"
          >
            <LogOut aria-hidden />
          </CircleButton>
        </ButtonCapsule>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border px-2.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar className="size-7 shrink-0 bg-muted text-xs font-medium text-foreground">
          <AvatarFallback>
            {user?.name.slice(0, 1).toUpperCase() ?? "K"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-foreground">
              {user?.name}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {user?.email ?? user?.phone ?? COMPANY_DETAILS.name}
          </div>
        </div>
        <ButtonCapsule>
          <CircleButton
            onClick={toggleTheme}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
            aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </CircleButton>
          <CircleButton
            onClick={() => void onLogout()}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
            className="[@media(hover:hover)]:hover:text-destructive"
          >
            <LogOut aria-hidden />
          </CircleButton>
        </ButtonCapsule>
      </div>
    </div>
  );
}

/** Mobile full-screen nav: brand header, shared nav rows, footer with identity
 * left and theme/logout actions right. */
function MobileDrawerContent({
  sections,
  pathname,
  search,
  onClose,
}: {
  sections: NavSection[];
  pathname: string;
  search: string;
  onClose: () => void;
}) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loggingOut, setLoggingOut] = useState(false);
  // Read once per account; the key is account-scoped, so a sign-in as
  // someone else starts from that account's own choice.
  const accountId = user?.id ?? null;
  const [density, setDensity] = useState<NavDensity>(() =>
    readNavDensity(accountId),
  );
  useEffect(() => {
    setDensity(readNavDensity(accountId));
  }, [accountId]);
  const changeDensity = (next: NavDensity) => {
    setDensity(next);
    writeNavDensity(accountId, next);
  };
  const toggleGroup = (to: string) =>
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/auth", { replace: true });
    } catch {
      // Local session state is already torn down by the store; stay put.
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="shrink-0 px-4 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top,0px))]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pt-1">
            <div className="truncate text-2xl font-bold tracking-[-0.022em]">
              KS Biz App
            </div>
            <div className="mt-1 truncate text-[13px] text-muted-foreground">
              {COMPANY_DETAILS.name}
            </div>
          </div>
          <CircleButton
            size="touch"
            onClick={onClose}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <X aria-hidden />
          </CircleButton>
        </div>
        <div className="mt-3 flex justify-end md:hidden">
          <NavDensityToggle value={density} onChange={changeDensity} />
        </div>
      </div>

      <NavList
        idPrefix="drawer"
        sections={sections}
        expanded={expanded}
        onToggleGroup={toggleGroup}
        pathname={pathname}
        search={search}
        onNavigate={onClose}
        density={density}
      />

      <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-9 shrink-0 bg-muted text-sm font-semibold text-foreground">
              <AvatarFallback>
                {user?.name.slice(0, 1).toUpperCase() ?? "K"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium">
                {user?.name}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {user?.email ?? user?.phone ?? COMPANY_DETAILS.name}
              </div>
            </div>
          </div>
          <ButtonCapsule className="shrink-0">
            <CircleButton
              onClick={toggleTheme}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
            >
              {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </CircleButton>
            <CircleButton
              onClick={() => void onLogout()}
              disabled={loggingOut}
              aria-label="Log out"
              title="Log out"
              className="[@media(hover:hover)]:hover:text-destructive"
            >
              <LogOut aria-hidden />
            </CircleButton>
          </ButtonCapsule>
        </div>
      </div>
    </div>
  );
}

function HeaderBar({
  sections,
  onOpenMobile,
  floating = false,
}: {
  sections: NavSection[];
  onOpenMobile: () => void;
  floating?: boolean;
}) {
  if (floating) {
    return (
      <div className="phone-menu-float md:hidden">
        <CircleButton
          size="touch"
          aria-label="Open navigation menu"
          title="Open navigation menu"
          onClick={onOpenMobile}
          className="menu-float-circle"
        >
          <PanelLeft className="size-5" aria-hidden />
        </CircleButton>
      </div>
    );
  }
  const location = useLocation();

  const currentLabel = (() => {
    for (const section of sections) {
      for (const item of section.items) {
        const activeSub = item.subItems?.find((sub) =>
          isSubActive(sub, location.pathname, location.search),
        );
        if (activeSub) return activeSub.label;
        if (isItemActive(item, location.pathname)) return item.label;
      }
    }
    return "Home";
  })();

  return (
    // The header owns its band as a drag surface — nothing else lays a drag
    // rect over it, so its free middle moves the window and every control
    // inside it is no-drag (nested island + the app-wide rule in globals.css).
    <header
      className="sticky top-0 z-30 hidden items-center gap-2 border-b border-border bg-background/85 px-4 pr-[calc(1rem+var(--wc-w))] backdrop-blur-xl sm:pl-6 sm:pr-[calc(1.5rem+var(--wc-w))] supports-[backdrop-filter]:bg-background/70 md:flex"
      style={{
        ...dragStyle,
        // Fixed h-14 plus the status-bar inset: paddingTop alone would shrink
        // the content box and push a 44px touch target over the hairline.
        height: "calc(3.5rem + env(safe-area-inset-top, 0px))",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="truncate text-[13px] font-medium tracking-tight text-foreground">
          {currentLabel}
        </div>
      </div>

      {/* no-drag island nested inside the drag row — a descendant is always
          collected after its ancestor, so this wins regardless of z-index. */}
      <div
        className="ml-auto flex min-w-0 items-center gap-3"
        style={noDragStyle}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Building2 className="size-3 shrink-0" aria-hidden />
          <span className="hidden truncate max-w-[140px] min-[380px]:inline">
            {COMPANY_DETAILS.name}
          </span>
          <span className="truncate max-w-[72px] min-[380px]:hidden">
            {COMPANY_DETAILS.name.split(" ")[0]}
          </span>
        </span>
      </div>
    </header>
  );
}

const AppShellContext = createContext<boolean>(false);

/** Phone bottom bar: the primary shortcuts plus More (full drawer). */
function useTabBarItems(sections: NavSection[]): TabBarItem[] {
  return useMemo(() => {
    const all = sections.flatMap((s) => s.items);
    const preferred = [
      all.find((i) => i.to === "/"),
      all.find((i) => i.to === "/devices"),
    ].filter((i): i is NonNullable<typeof i> => !!i);
    const seen = new Set<string>();
    return preferred
      .filter((i) => {
        if (seen.has(i.to)) return false;
        seen.add(i.to);
        return true;
      })
      .map((i) => ({ to: i.to, label: i.label, icon: i.icon, end: i.end }));
  }, [sections]);
}

function InnerPageLoader({ pathname }: { pathname: string }) {
  // One skeleton per screen, shaped like the content it stands in for
  // (design.md Section 3.1).
  return routeSkeleton(pathname);
}

export function AppShell({ children }: { children?: ReactNode }) {
  const isInsideShell = useContext(AppShellContext);
  if (isInsideShell) {
    return <>{children}</>;
  }
  return <AppShellInternal>{children}</AppShellInternal>;
}

function AppShellInternal({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sections = SECTIONS;

  // Sidebar search narrows the nav in place. A group survives the filter when
  // it matches itself or when any of its sub-items match.
  const [navQuery, setNavQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredSections = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.subItems?.some((sub) => sub.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, navQuery]);

  // Clearing the query when the rail collapses keeps a half-typed filter from
  // reappearing as an empty nav when the sidebar opens again.
  useEffect(() => {
    if (railCollapsed) setNavQuery("");
  }, [railCollapsed]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (to: string) =>
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));

  const toggleRail = useCallback(() => {
    setRailCollapsed((v) => !v);
  }, []);

  // Hovering the collapsed rail previews the full sidebar as an overlay.
  // Timers give hover intent; the page underneath never moves.
  const [railHot, setRailHot] = useState(false);
  const railTimer = useRef<number | null>(null);
  const clearRailTimer = () => {
    if (railTimer.current) {
      window.clearTimeout(railTimer.current);
      railTimer.current = null;
    }
  };
  useEffect(
    () => () => {
      if (railTimer.current) window.clearTimeout(railTimer.current);
    },
    [],
  );
  const onRailEnter = () => {
    if (!railCollapsed) return;
    clearRailTimer();
    railTimer.current = window.setTimeout(() => setRailHot(true), 120);
  };
  const onRailLeave = () => {
    clearRailTimer();
    railTimer.current = window.setTimeout(() => setRailHot(false), 180);
  };
  // Pinning the sidebar open cancels any pending hover preview.
  useEffect(() => {
    if (!railCollapsed) {
      clearRailTimer();
      setRailHot(false);
    }
  }, [railCollapsed]);
  const railOpen = !railCollapsed || railHot;

  const tabBarItems = useTabBarItems(sections);

  useNetworkState();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(railCollapsed));
    } catch {
      // private mode — collapse state just won't persist
    }
  }, [railCollapsed]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Desktop scroller lives below the header — reset it on navigation too.
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Focus the drawer when it opens, keep Tab inside it while it is open, and
  // hand focus back to the trigger on close — `aria-modal` promises both.
  useEffect(() => {
    if (!mobileOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = drawerRef.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.offsetParent !== null);
    const id = window.setTimeout(() => {
      (focusables()[0] ?? el)?.focus({ preventScroll: true });
    }, 120);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const inside = !!el && !!active && el.contains(active);
      // Wrap at either end, and pull focus back if it escaped the sheet.
      if (!inside || (e.shiftKey ? active === first : active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKeyDown);
      if (opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleRail();
      }
      if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (railCollapsed) toggleRail();
        window.setTimeout(
          () => searchRef.current?.focus({ preventScroll: true }),
          railCollapsed ? 220 : 0,
        );
      }
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
      if (e.key === "Escape" && railHot) setRailHot(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, toggleRail, railHot]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <AppShellContext.Provider value={true}>
      <div className="app-shell-root min-h-dvh w-full bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to main content
        </a>

        {/* Desktop sidebar — pinned open it is a layout column; a collapsed
            rail expands on hover as an overlay (design.md Section 4/Section 5). The aside
            itself carries no app-region: its brand row owns the window's
            top-left drag band (see the row below), and every row under it is
            ordinary clickable surface. */}
        <motion.aside
          layout
          layoutRoot
          transition={{
            layout: reduceMotion
              ? { duration: 0 }
              : railOpen
                ? MORPH
                : MORPH_EXIT,
          }}
          onMouseEnter={onRailEnter}
          onMouseLeave={onRailLeave}
          className={cn(
            // Full window height — the brand row is the top-left corner of
            // the window; --tl-inset clears the macOS traffic lights above it.
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card pt-[var(--tl-inset)] md:flex",
            railOpen ? "w-60" : "w-14",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!railOpen ? (
              <motion.div
                key="rail"
                className="flex min-h-0 flex-1 flex-col"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        transition: { duration: 0.11, ease: EASE_OUT },
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.14, ease: EASE_OUT }
                }
              >
                {/* Rail brand row: the window's top-left drag band. */}
                <div
                  className="flex h-14 shrink-0 items-center justify-center border-b border-border"
                  style={dragStyle}
                >
                  <Brand compact />
                </div>
                <div className="flex justify-center pb-1 pt-2">
                  <CircleButton
                    onClick={toggleRail}
                    title="Expand sidebar (Ctrl+B)"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeft aria-hidden />
                  </CircleButton>
                </div>
                <NavRail sections={sections} pathname={location.pathname} />
                <UserFooter compact />
              </motion.div>
            ) : (
              <motion.div
                key="full"
                className="flex min-h-0 flex-1 flex-col"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        transition: { duration: 0.11, ease: EASE_OUT },
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.14, ease: EASE_OUT }
                }
              >
                {/* Full brand row: drag band for the window's top-left corner.
                    The brand text is part of the band; the toggle is a
                    nested no-drag island (plus the app-wide control rule), so
                    the window never drags out from under the click. */}
                <div
                  className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2.5"
                  style={dragStyle}
                >
                  <div className="min-w-0 flex-1">
                    <Brand />
                  </div>
                  <CircleButton
                    onClick={toggleRail}
                    title="Collapse sidebar (Ctrl+B)"
                    aria-label="Collapse sidebar"
                    style={noDragStyle}
                  >
                    <PanelLeft aria-hidden />
                  </CircleButton>
                </div>
                <NavSearch
                  value={navQuery}
                  onChange={setNavQuery}
                  inputRef={searchRef}
                />
                <NavList
                  idPrefix="sidebar"
                  sections={filteredSections}
                  expanded={expanded}
                  onToggleGroup={toggleGroup}
                  pathname={location.pathname}
                  search={location.search}
                />
                <UserFooter />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* Desktop: the header stays a fixed row and the routed content
            scrolls in .shell-scroll below it, so the page scrollbar starts
            under the header line — never beside the window controls. */}
        <div
          className={cn(
            "app-shell-col flex min-h-dvh flex-col transition-[padding-left] morph-layout motion-reduce:transition-none",
            railCollapsed ? "md:pl-14" : "morph-open md:pl-60",
          )}
        >
          <HeaderBar
            sections={sections}
            onOpenMobile={() => setMobileOpen(true)}
            floating
          />
          <div className="hidden md:block">
            <HeaderBar
              sections={sections}
              onOpenMobile={() => setMobileOpen(true)}
            />
          </div>
          <OfflineBanner />

          <div ref={scrollRef} className="shell-scroll">
            <main id="main-content" className="min-w-0" tabIndex={-1}>
              <AnimatePresence mode="wait" initial={false}>
                <PageTransition
                  key={location.pathname}
                  className="mx-auto w-full max-w-[75rem] px-4 pt-16 pb-28 sm:px-6 md:pt-6 md:pb-8 xl:px-8"
                >
                  <Suspense
                    fallback={<InnerPageLoader pathname={location.pathname} />}
                  >
                    {children ?? <Outlet />}
                  </Suspense>
                </PageTransition>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Phone bottom bar (Section 2.7.2) — frosted capsule above content; hidden
            with the drawer, chrome-less routes, and on desktop. */}
        <TabBar
          items={tabBarItems}
          pathname={location.pathname}
          onMore={() => setMobileOpen(true)}
          hidden={mobileOpen}
        />

        {/* Mobile nav — full-screen sheet. Opened by buttons, closed by X,
            Escape or navigation. No scrim: the sheet covers the viewport. */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-0 z-50 md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{
                x: "-100%",
                transition: {
                  duration: reduceMotion ? 0 : 0.2,
                  ease: EASE_DRAWER,
                },
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.28, ease: EASE_DRAWER }
              }
            >
              <MobileDrawerContent
                sections={sections}
                pathname={location.pathname}
                search={location.search}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShellContext.Provider>
  );
}
