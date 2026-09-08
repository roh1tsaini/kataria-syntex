/**
 * Update surface — mounted once in App alongside the Toaster. Renders:
 * - the blocking update dialog when the server (426) or the published
 *   minVersion floors this client;
 * - the "update ready" banner strip under the title bar for non-blocking
 *   availability (web service worker waiting, macOS dmg);
 * - the Windows/Linux "restart to update" toast when electron-updater has
 *   staged the installer.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useUpdates, showUpdateBanner } from "@/store/updates";
import { detectHost } from "@/lib/platform";
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
    // Windows/Linux only: macOS and web use the banner.
    if (
      detectHost() !== "electron" ||
      window.desktop?.platform === "darwin" ||
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
  const status = useUpdates((s) => s.status);
  const percent = useUpdates((s) => s.percent);
  const swWaiting = useUpdates((s) => s.swWaiting);
  const reduceMotion = useReducedMotion();
  const downloading = status === "downloading";

  // Web copy vs native-artifact copy — one banner component, two flows.
  const message =
    detectHost() === "web"
      ? latestVersion
        ? `Version ${latestVersion} is ready — reload to apply.`
        : "A new version is ready — reload to apply."
      : `Version ${latestVersion} is available (installed v${__APP_VERSION__})`;

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
            <p className="text-[13px] leading-tight text-accent-foreground">
              {message}{" "}
            </p>
            <Button
              size="sm"
              className="h-8"
              onClick={() => void installUpdate()}
              disabled={downloading}
              loading={downloading && !swWaiting}
            >
              {detectHost() === "web" ? "Reload to update" : "Update"}
            </Button>
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
