import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { desktopWindow, type DesktopWindow } from "@/lib/platform";
import { cn } from "@/ui/lib/cn";

/**
 * Electron window chrome, blended (design.md §2.7.1): there is no bar — the
 * app surface runs to every window edge. Two floating pieces, Electron-only
 * (web/PWA and Capacitor render nothing):
 *
 * - An invisible drag strip across the top 3.5rem. On shell routes it sits
 *   beneath the header and sidebar (the header carries the drag regions);
 *   on chrome-less routes (auth, print, scan, 404) it is the drag surface.
 * - The window-control cluster pinned flush into the top-right corner
 *   (Windows/Linux; macOS keeps its native traffic lights instead). Its
 *   width is reserved by --wc-w so header content never slides beneath it.
 */

const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;

function MinGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.75" aria-hidden>
      <path
        d="M1.5 6h9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MaxGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-2.75"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="2" y="2" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function RestoreGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-2.75"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M4 2.5h5.5V8" strokeLinecap="round" />
      <rect x="2" y="4" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.75" aria-hidden>
      <path
        d="M2 2l8 8M10 2l-8 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
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
        "grid w-10 touch-44 shrink-0 place-items-center text-muted-foreground",
        "transition-colors hover:bg-foreground/10 hover:text-foreground",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        // Windows close-button red, full bleed to the corner
        destructive && "hover:bg-[#e81123] hover:text-white",
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
    <>
      {/* Invisible drag surface across the top; double-click toggles
          maximize natively via the HTCAPTION region. */}
      <div
        className="fixed inset-x-0 top-0 z-20 h-14 print:hidden"
        style={dragStyle}
      />

      {win.platform !== "darwin" && (
        <div className="fixed top-0 right-0 z-40 flex h-14 items-stretch print:hidden">
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
    </>
  );
}
