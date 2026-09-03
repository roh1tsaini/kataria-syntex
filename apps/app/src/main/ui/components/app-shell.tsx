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
import {
  NavLink,
  useLocation,
  useNavigate,
  Link,
  Outlet,
} from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  LogOut,
  Moon,
  Plus,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
  X,
  MoreHorizontal,
} from "lucide-react";
import { useAuth, isPackerOnlyWorkspace } from "@/store/auth";
import { Button } from "@/ui/components/ui/button";
import { ButtonCapsule, CircleButton } from "@/ui/components/ui/circle-button";
import { Avatar, AvatarFallback } from "@/ui/components/ui/avatar";
import { PageTransition, Skeleton } from "@/ui/components/motion";
import { AccentPicker } from "@/ui/components/accent-picker";
import { SyncBanner, SyncDialog } from "@/ui/components/sync-dialog";
import { useTheme } from "@/ui/hooks/use-theme";
import { useOfflineSync, useSync } from "@/lib/offline/sync";
import {
  BOTTOM_ITEMS,
  isItemActive,
  isSubActive,
  PACKER_SECTIONS,
  SECTIONS,
  SIDEBAR_STORAGE_KEY,
  useCanSee,
  type NavSection,
} from "@/ui/components/nav-config";
import { cn } from "@/ui/lib/cn";
import { EASE } from "@/ui/lib/motion";
import { roleBadge } from "@/ui/components/role-badge";

function Brand({ compact }: { compact?: boolean }) {
  const company = useAuth((s) => s.company);
  const workspace = useAuth((s) => s.workspace);
  const workspaceLabel = company?.name ?? workspace?.name ?? "Workspace";

  if (compact) {
    return (
      <div
        className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background"
        title={`Kataria Challan — ${workspaceLabel}`}
      >
        <span className="text-[11px] font-semibold leading-none" aria-hidden>
          K
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
          <span>Kataria</span>
          <span className="font-medium text-muted-foreground">Challan</span>
        </div>
        <div className="truncate text-[11px] font-normal text-muted-foreground">
          {workspaceLabel}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-3">
      <span className="select-none text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

/** Expanded sidebar navigation with collapsible groups. */
function NavList({
  sections,
  expanded,
  onToggleGroup,
  pathname,
  search,
  onNavigate,
}: {
  sections: NavSection[];
  expanded: Record<string, boolean>;
  onToggleGroup: (to: string) => void;
  pathname: string;
  search: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 [scrollbar-width:thin]">
      {sections.map((section, i) => (
        <div key={section.title} className={cn(i > 0 && "mt-3")}>
          <SectionLabel>{section.title}</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isItemActive(item, pathname);
              const hasSubs = !!item.subItems?.length;
              const anySubActive =
                item.subItems?.some((sub) =>
                  isSubActive(sub, pathname, search),
                ) ?? false;
              const isExpanded = expanded[item.to] ?? anySubActive;
              const on = active || anySubActive;

              return (
                <div key={item.to}>
                  {hasSubs ? (
                    <button
                      type="button"
                      onClick={() => onToggleGroup(item.to)}
                      aria-expanded={isExpanded}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150 ease-[var(--ease-out)]",
                        on
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 opacity-60 transition-transform duration-150",
                          isExpanded ? "rotate-0" : "-rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150 ease-[var(--ease-out)]",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                    </NavLink>
                  )}
                  {hasSubs && (
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-150 ease-[var(--ease-out)]",
                        isExpanded
                          ? "mt-0.5 grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3">
                          {item.subItems?.map((sub) => {
                            const subActive = isSubActive(
                              sub,
                              pathname,
                              search,
                            );
                            return (
                              <NavLink
                                key={sub.to}
                                to={sub.to}
                                onClick={onNavigate}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150",
                                  subActive
                                    ? "bg-accent font-medium text-accent-foreground"
                                    : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/60 [@media(hover:hover)]:hover:text-foreground",
                                )}
                              >
                                <span
                                  className={cn(
                                    "size-1 shrink-0 rounded-full",
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
                      </div>
                    </div>
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
                "grid size-9 shrink-0 place-items-center rounded-md transition-colors duration-150",
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
  const workspace = useAuth((s) => s.workspace);
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
            {roleBadge(workspace?.isPrimaryAdmin)}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {workspace?.name}
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

/** Mobile drawer body: profile, quick actions, full nav, footer. */
function MobileDrawerContent({
  sections,
  pathname,
  search,
  onClose,
  onOpenSync,
}: {
  sections: NavSection[];
  pathname: string;
  search: string;
  onClose: () => void;
  onOpenSync: () => void;
}) {
  const user = useAuth((s) => s.user);
  const workspace = useAuth((s) => s.workspace);
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const online = useSync((s) => s.online);
  const pendingCount = useSync((s) => s.pendingCount);
  const can = useCanSee();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (to: string) =>
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="shrink-0 border-b border-border p-4 pb-3.5 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="flex items-start justify-between">
          <div className="relative">
            <Avatar className="size-11 bg-muted text-sm font-semibold text-foreground">
              <AvatarFallback>
                {user?.name.slice(0, 2).toUpperCase() ?? "KS"}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-card",
                online ? "bg-success" : "bg-warning",
              )}
              aria-hidden
            />
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

        <div className="mt-3">
          <div className="truncate text-[15px] font-semibold tracking-tight">
            {user?.name}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="truncate">
              {company?.name ?? workspace?.name ?? "Kataria Syntex"}
            </span>
            {roleBadge(workspace?.isPrimaryAdmin)}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden />
            <span>FY {currentFy?.label ?? "—"}</span>
          </div>
          <button
            type="button"
            onClick={onOpenSync}
            className="flex min-h-8 items-center gap-1.5 text-xs font-semibold text-primary"
          >
            {online ? (
              <>
                <Wifi className="size-3.5 text-success" aria-hidden />
                <span>
                  {pendingCount > 0 ? `${pendingCount} pending` : "Synced"}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5 text-warning" aria-hidden />
                <span>Offline</span>
              </>
            )}
          </button>
        </div>

        {can(["create_challan"]) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button asChild variant="accent" className="w-full">
              <Link to="/challans/new" onClick={onClose}>
                <Plus className="size-4" aria-hidden />
                Sales challan
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/outward/new" onClick={onClose}>
                <Plus className="size-4" aria-hidden />
                Job work
              </Link>
            </Button>
          </div>
        )}
      </div>

      <NavList
        sections={sections}
        expanded={expanded}
        onToggleGroup={toggleGroup}
        pathname={pathname}
        search={search}
        onNavigate={onClose}
      />

      <div className="shrink-0 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <AccentPicker />
      </div>
    </div>
  );
}

function MobileBottomNav({
  onOpenDrawer,
  pendingBadge,
}: {
  onOpenDrawer: () => void;
  pendingBadge?: number;
}) {
  const { pathname } = useLocation();
  const can = useCanSee();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/80 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-[480px] items-stretch justify-around gap-1 px-2 py-1.5">
        {BOTTOM_ITEMS.filter((item) => can(item.permissions)).map((item) => {
          const active = item.end
            ? pathname === item.to
            : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "font-medium text-muted-foreground active:bg-muted/60",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              <span className="leading-none tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium text-muted-foreground transition-colors active:bg-muted/60"
          aria-label="Open menu"
        >
          <span className="relative grid place-items-center">
            <MoreHorizontal className="size-4" aria-hidden />
            {pendingBadge != null && pendingBadge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-destructive text-[9px] font-medium leading-none text-destructive-foreground">
                {pendingBadge > 9 ? "9+" : pendingBadge}
              </span>
            )}
          </span>
          <span className="leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}

function HeaderBar({
  sections,
  onOpenMobile,
}: {
  sections: NavSection[];
  onOpenMobile: () => void;
}) {
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const online = useSync((s) => s.online);

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
    if (location.pathname.startsWith("/reports")) return "Reports";
    return "Dashboard";
  })();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-xl sm:px-6"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <button
        type="button"
        onClick={onOpenMobile}
        className="relative grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Open navigation menu"
      >
        <Avatar className="size-8 bg-muted text-xs font-medium text-foreground">
          <AvatarFallback>
            {user?.name.slice(0, 1).toUpperCase() ?? "K"}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0.5 right-0.5 size-2 rounded-full ring-2 ring-card",
            online ? "bg-success" : "bg-warning",
          )}
          aria-hidden
        />
      </button>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <div className="truncate text-[13px] font-medium tracking-tight text-foreground">
          {currentLabel}
        </div>
      </div>

      <div className="min-w-0 flex-1 truncate text-center text-[13px] font-medium tracking-tight md:hidden">
        {currentLabel}
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1.5">
        <div className="hidden sm:flex items-center">
          <AccentPicker />
        </div>
        <span className="hidden items-center gap-1 rounded-sm border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground xl:inline-flex">
          <CalendarDays className="size-3.5" aria-hidden />
          FY {currentFy?.label ?? "—"}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
          <Building2 className="size-3 shrink-0" aria-hidden />
          <span className="hidden truncate max-w-[140px] min-[380px]:inline">
            {company?.name ?? "Kataria Syntex"}
          </span>
          <span className="truncate max-w-[72px] min-[380px]:hidden">
            {(company?.name ?? "Kataria").split(" ")[0]}
          </span>
        </span>
      </div>
    </header>
  );
}

export const AppShellContext = createContext<boolean>(false);

function InnerPageLoader() {
  return (
    <div className="w-full space-y-6">
      <div>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-8 w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const isInsideShell = useContext(AppShellContext);
  if (isInsideShell) {
    return <>{children}</>;
  }
  return <AppShellInternal>{children}</AppShellInternal>;
}

function AppShellInternal({ children }: { children?: ReactNode }) {
  const workspace = useAuth((s) => s.workspace);
  const refreshCompany = useAuth((s) => s.refreshCompany);
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const pendingCount = useSync((s) => s.pendingCount);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const drawerRef = useRef<HTMLDivElement>(null);

  const isPacker = isPackerOnlyWorkspace(workspace);
  const can = useCanSee();
  const sections = useMemo(() => {
    if (isPacker) return PACKER_SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((i) => can(i.permissions)),
    })).filter((s) => s.items.length > 0);
  }, [isPacker, can]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (to: string) =>
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));

  const toggleRail = useCallback(() => {
    setRailCollapsed((v) => !v);
  }, []);

  useOfflineSync();

  useEffect(() => {
    refreshCompany().catch(() => {});
  }, [refreshCompany]);

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
  }, [location.pathname]);

  // Focus the drawer when it opens.
  useEffect(() => {
    if (!mobileOpen) return;
    const id = window.setTimeout(() => {
      const el = drawerRef.current;
      if (!el) return;
      const first =
        el.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? el;
      first.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(id);
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
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, toggleRail]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const drawerTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: EASE };

  return (
    <AppShellContext.Provider value={true}>
      <div className="min-h-dvh w-full bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to main content
        </a>

        {/* Desktop sidebar — static layout column, never an overlay.
            Collapses to an icon rail; no hover-peek, no drag gestures. */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card md:flex",
            railCollapsed ? "w-14" : "w-60",
          )}
        >
          {railCollapsed ? (
            <>
              <div className="flex h-14 shrink-0 items-center justify-center border-b border-border">
                <Brand compact />
              </div>
              <div className="flex justify-center pb-1 pt-2">
                <CircleButton
                  onClick={toggleRail}
                  title="Expand sidebar (Ctrl+B)"
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpen aria-hidden />
                </CircleButton>
              </div>
              <NavRail sections={sections} pathname={location.pathname} />
              <UserFooter compact />
            </>
          ) : (
            <>
              <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2.5">
                <div className="min-w-0 flex-1">
                  <Brand />
                </div>
                <CircleButton
                  onClick={toggleRail}
                  title="Collapse sidebar (Ctrl+B)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose aria-hidden />
                </CircleButton>
              </div>
              <NavList
                sections={sections}
                expanded={expanded}
                onToggleGroup={toggleGroup}
                pathname={location.pathname}
                search={location.search}
              />
              <UserFooter />
            </>
          )}
        </aside>

        {/* Content column sits next to the sidebar; no reflow animation. */}
        <div
          className={cn(
            "flex min-h-dvh flex-col",
            railCollapsed ? "md:pl-14" : "md:pl-60",
          )}
        >
          <HeaderBar
            sections={sections}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <SyncBanner onOpen={() => setSyncOpen(true)} />
          <SyncDialog open={syncOpen} onOpenChange={setSyncOpen} />

          <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
            <AnimatePresence mode="wait" initial={false}>
              <PageTransition
                key={location.pathname}
                className="mx-auto w-full max-w-[75rem] px-4 pt-6 pb-28 sm:px-6 md:pb-8 xl:px-8"
              >
                <Suspense fallback={<InnerPageLoader />}>
                  {children ?? <Outlet />}
                </Suspense>
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>

        <MobileBottomNav
          onOpenDrawer={() => setMobileOpen(true)}
          pendingBadge={pendingCount}
        />

        {/* Mobile drawer — plain slide-in over a scrim. Opened by buttons,
            closed by scrim tap, X, Escape or navigation. No drag gestures. */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40 bg-background/60 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE }
                }
              />
              <motion.div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] md:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.24,
                        ease: EASE,
                        // exits a touch faster than entries (design.md §5.2)
                      }
                }
              >
                <MobileDrawerContent
                  sections={sections}
                  pathname={location.pathname}
                  search={location.search}
                  onClose={() => setMobileOpen(false)}
                  onOpenSync={() => {
                    setMobileOpen(false);
                    setSyncOpen(true);
                  }}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppShellContext.Provider>
  );
}
