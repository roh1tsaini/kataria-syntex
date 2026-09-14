/**
 * Update surface — mounted once in App alongside the Toaster. Renders:
 * - the blocking update dialog when the server (426) or the published
 *   minVersion floors this client;
 * - the banner strip under the title bar for the macOS dmg prompt, with a
 *   dismiss that defers the notice until the next version ships;
 * - the Windows/Linux "restart to update" toast when electron-updater has
 *   staged the installer.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useUpdates, showUpdateBanner } from "@/store/updates";
import { desktopBridge, detectHost } from "@/lib/platform";
import { UpdateDialog } from "@/ui/components/update-dialog";
import { Button } from "@/ui/components/ui/button";
import { EASE_OUT } from "@/ui/lib/motion";

// Electron's invisible drag strip covers the top of the window; subtract the
// banner row from it so the Update button stays clickable.
const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

function UpdateReadyToast() {
  const status = useUpdates((s) => s.status);
  const latestVersion = useUpdates((s) => s.latestVersion);
  const required = useUpdates((s) => s.requiredMinVersion);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const toastedFor = useRef<string | null>(null);

  useEffect(() => {
    // Windows/Linux only: macOS has the banner; web and Android update in
    // the background and expose their deliberate actions in Settings.
    if (
      desktopBridge()?.platform === "darwin" ||
      detectHost() === "android" ||
      required
    )
      return;
    if (status !== "ready" || !latestVersion) return;
    if (toastedFor.current === latestVersion) return;
    toastedFor.current = latestVersion;
    toast.success("Update ready", {
      description: `Version ${latestVersion} installs the next time the app restarts.`,
      duration: 8000,
      action: {
        label: "Restart now",
        onClick: () => void installUpdate(),
      },
    });
  }, [status, latestVersion, required, installUpdate]);

  return null;
}

function UpdateBanner() {
  const show = useUpdates(showUpdateBanner);
  const latestVersion = useUpdates((s) => s.latestVersion);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const dismiss = useUpdates((s) => s.dismiss);
  const required = useUpdates((s) => s.requiredMinVersion);
  const reduceMotion = useReducedMotion();
  // This surface is macOS-only. Browser and Android availability checks stay
  // in the background and are available from Settings; required updates use
  // the blocking dialog instead.
  const message = `Version ${latestVersion} is available (installed v${__APP_VERSION__})`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT }}
          className="overflow-hidden border-b border-border bg-accent/10"
        >
          <div
            className="flex min-h-11 items-center justify-between gap-3 pl-4 pr-[calc(1rem+var(--wc-w))] sm:pl-6 sm:pr-[calc(1.5rem+var(--wc-w))]"
            style={noDragStyle}
          >
            <p className="min-w-0 truncate text-[13px] leading-tight text-accent-foreground">
              {message}{" "}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                className="h-8"
                onClick={() => void installUpdate()}
              >
                Update
              </Button>
              {!required && (
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss update notice"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors duration-150 [@media(hover:hover)]:hover:bg-muted/60 [@media(hover:hover)]:hover:text-foreground [@media(pointer:coarse)]:size-11"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function UpdateSurface() {
  return (
    <>
      <UpdateReadyToast />
      <UpdateBanner />
      <UpdateDialog />
    </>
  );
}
