import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { desktopWindow, type DesktopWindow } from "@/lib/platform";
import { cn } from "@/ui/lib/cn";

/**
 * Electron-only custom title bar — the window chrome modern Electron apps
 * draw themselves (Spotify, Discord): a 36px drag strip, no system bar.
 * Windows/Linux get app-drawn controls; macOS keeps its native traffic
 * lights riding the strip. Web/PWA and Capacitor render nothing.
 *
 * Its height is published as --titlebar-h on <html> by the entry
 * (src/main/main.tsx) before first paint, so every root container's 100dvh
 * math stays correct without per-page changes.
 *
 * Sticky-pinned: the bar never scrolls away with the content underneath it.
 */

const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;
const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

function MinGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaxGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function RestoreGlyph() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="size-2.5"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M2.5 2.5v-2h7v7h-2" />
      <rect x="0.5" y="2.5" width="7" height="7" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function ControlButton({
  label,
  destructive,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid w-12 touch-44 h-auto place-items-center text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        destructive && "hover:bg-destructive hover:text-destructive-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const [win, setWin] = useState<DesktopWindow | null>(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const w = desktopWindow();
    if (!w) return;
    setWin(w);
    void w
      .isMaximized()
      .then(setMaximized)
      .catch(() => {});
    return w.onMaximizedChange(setMaximized);
  }, []);

  if (!win) return null;

  return (
    <header
      className="sticky top-0 z-50 flex h-9 shrink-0 select-none items-stretch bg-background print:hidden"
      style={dragStyle}
    >
      {/* Drag surfaces — double-click toggles maximize natively via the
          HTCAPTION region; buttons stay no-drag islands. */}
      <div className="flex-1" />
      {win.platform !== "darwin" && (
        <div className="flex items-stretch" style={noDragStyle}>
          <ControlButton label="Minimize" onClick={() => void win.minimize()}>
            <MinGlyph />
          </ControlButton>
          <ControlButton
            label={maximized ? "Restore" : "Maximize"}
            onClick={() => void win.toggleMaximize()}
          >
            {maximized ? <RestoreGlyph /> : <MaxGlyph />}
          </ControlButton>
          <ControlButton
            label="Close"
            destructive
            onClick={() => void win.close()}
          >
            <CloseGlyph />
          </ControlButton>
        </div>
      )}
    </header>
  );
}
