import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { desktopWindow } from "@/lib/platform";
import { cn } from "@/ui/lib/cn";

/**
 * Electron window chrome, blended (design.md Section 2.7.1): there is no bar — the
 * app surface runs to every window edge. Electron-only; web and Android
 * render nothing.
 *
 * **How app-region actually resolves.** Chromium collects every
 * `-webkit-app-region` rect in layout-tree pre-order
 * (`LocalFrameView::CollectDraggableRegions`) and Electron applies that list
 * in order, LAST RECT WINS — `drag_util.cc`: "where rects overlap, the later
 * rect wins, so a point ends up draggable exactly when the last rect in the
 * list that contains it is draggable". z-index is never consulted. A `no-drag`
 * rect therefore beats a `drag` rect only when it comes later, which gives
 * exactly one order-independent case: a control NESTED INSIDE the drag row it
 * sits in (a descendant is always collected after its ancestor). Everything
 * else — a no-drag rect in a sibling subtree, matched only by mount order —
 * is a trap that silently re-arms when a refactor reorders a tree.
 *
 * So the chrome obeys one rule: THE STRIP IS THE FIRST ELEMENT IN THE APP
 * ROOT, and every other app-region rect is a descendant of it or a later
 * sibling. Last-rect-wins then always lands on the surface, never on the
 * strip:
 *
 * - `ChromeDragStrip`: the one invisible drag rect across the top 3.5rem,
 *   rendered first in App. Its free space moves the window; double-click
 *   toggles maximize via HTCAPTION.
 * - Owned bands: the header row and the sidebar brand row are `drag` too, so
 *   the band reads as one continuous title area whatever the strip is doing
 *   beneath it. Their controls are nested `no-drag` islands.
 * - Every control in the desktop shell is `no-drag` (globals.css), so a
 *   control can never be swallowed even if a future drag rect is added.
 * - `WindowControls`: pinned flush into the top-right corner (Windows/Linux;
 *   macOS keeps its native traffic lights instead) in Windows 11 caption
 *   geometry — 46×32 Fluent buttons. Its width is reserved by --wc-w so
 *   header content never slides beneath it.
 */

export const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;
export const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

/** One Fluent caption glyph (design.md Section 2.7.1): 16px box, 1px
 * hairline strokes — inline SVG, never an icon font. */
function CaptionGlyph({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      className="size-4"
    >
      {children}
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
        // Windows 11 caption geometry: 32px tall at the window edge; the
        // coarse-pointer 44px floor grows the touch target from below.
        "grid h-8 w-[var(--wc-btn-w)] touch-44 shrink-0 place-items-center",
        "text-[var(--wc-icon)] transition-colors",
        "hover:bg-[var(--wc-hover)] active:bg-[var(--wc-active)]",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        // Windows close-button red, full bleed to the corner
        destructive &&
          "hover:bg-[#c42b1c] hover:text-white active:bg-[#b0271a] active:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** The window's single drag rect, across the top 3.5rem. Rendered FIRST in
 * the App root — that position is the whole correctness argument: every other
 * app-region surface (sidebar brand row, header, overlays,
 * window controls) is a descendant or a later sibling, so last-rect-wins
 * always resolves onto that surface and never leaves a control stranded under
 * the strip. Electron-only, and `hidden` from print. */
export function ChromeDragStrip() {
  const win = desktopWindow();
  if (!win) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-20 h-14 print:hidden"
      style={dragStyle}
    />
  );
}

/** Floating window controls (Windows/Linux) — an overlay above whatever the
 * route renders, so it is mounted last in App. */
export function WindowControls() {
  // Stable identity: the desktop bridge exists before the renderer loads, so
  // a one-shot read is enough.
  const win = useMemo(() => desktopWindow(), []);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!win || win.platform === "darwin") return;
    void win
      .isMaximized()
      .then(setMaximized)
      .catch(() => {});
    return win.onMaximizedChange(setMaximized);
  }, [win]);

  if (!win || win.platform === "darwin") return null;

  return (
    <div
      className="fixed top-0 right-0 z-[60] flex print:hidden"
      style={noDragStyle}
    >
      <ControlButton label="Minimize" onClick={() => void win.minimize()}>
        <CaptionGlyph>
          <path d="M3 8.5h10" />
        </CaptionGlyph>
      </ControlButton>
      <ControlButton
        label={maximized ? "Restore" : "Maximize"}
        onClick={() => void win.toggleMaximize()}
      >
        {maximized ? (
          <CaptionGlyph>
            <path d="M5.5 2.5h8v8" />
            <rect x="2.5" y="5.5" width="8" height="8" />
          </CaptionGlyph>
        ) : (
          <CaptionGlyph>
            <rect x="3.5" y="3.5" width="9" height="9" />
          </CaptionGlyph>
        )}
      </ControlButton>
      <ControlButton label="Close" destructive onClick={() => void win.close()}>
        <CaptionGlyph>
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
        </CaptionGlyph>
      </ControlButton>
    </div>
  );
}
