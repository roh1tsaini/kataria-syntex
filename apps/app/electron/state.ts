/**
 * Desktop state that has to survive a restart: window geometry, maximized
 * state, and the last resolved theme background.
 *
 * One small JSON file in userData — no dependency, and a missing or corrupt
 * file simply means "first launch". Everything here is best-effort: a failed
 * write must never keep the window from opening.
 */
import { app, screen, type BrowserWindow, type Rectangle } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type DesktopState = {
  bounds?: Rectangle;
  maximized?: boolean;
  /** The renderer's resolved `--background`, so the next launch paints in the
   *  user's theme instead of flashing the built-in default. */
  backgroundColor?: string;
};

const FILE = () => join(app.getPath("userData"), "desktop-state.json");

let cache: DesktopState | null = null;

export async function loadDesktopState(): Promise<DesktopState> {
  if (cache) return cache;
  try {
    const raw: unknown = JSON.parse(await readFile(FILE(), "utf8"));
    cache =
      raw !== null && typeof raw === "object" ? (raw as DesktopState) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function saveDesktopState(patch: Partial<DesktopState>): void {
  cache = { ...(cache ?? {}), ...patch };
  void writeFile(FILE(), JSON.stringify(cache), "utf8").catch(() => {});
}

/**
 * Saved geometry is only reused when it still lands on a connected display —
 * restoring a window onto an unplugged monitor gives an invisible window.
 */
export function visibleBounds(bounds: Rectangle | undefined): Rectangle | null {
  if (
    !bounds ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height)
  )
    return null;
  const area = screen.getDisplayMatching(bounds).workArea;
  const overlapX =
    Math.min(bounds.x + bounds.width, area.x + area.width) -
    Math.max(bounds.x, area.x);
  const overlapY =
    Math.min(bounds.y + bounds.height, area.y + area.height) -
    Math.max(bounds.y, area.y);
  return overlapX > 80 && overlapY > 80 ? bounds : null;
}

/** Remembers geometry as the user moves/resizes, debounced off the drag loop. */
export function trackWindow(win: BrowserWindow): void {
  const persist = (): void => {
    if (win.isDestroyed()) return;
    saveDesktopState({
      bounds: win.isMaximized() ? win.getNormalBounds() : win.getBounds(),
      maximized: win.isMaximized(),
    });
  };
  let timer: NodeJS.Timeout | null = null;
  const debounced = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, 400);
  };
  win.on("resize", debounced);
  win.on("move", debounced);
  win.on("maximize", persist);
  win.on("unmaximize", persist);
  win.on("close", persist);
}
