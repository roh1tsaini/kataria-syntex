/**
 * Blocking update dialog — rendered once in App and shown whenever the
 * update store carries a requiredMinVersion (server 426 or published
 * minVersion). Undismissable by design: the API carries no backward
 * compatibility, so a client below the floor has nothing useful to do.
 * On web this is a last resort — the store reloads once silently first,
 * and the dialog only appears when the reloaded shell is still stale.
 *
 * The action follows the host: web reloads (index.html revalidates, so the
 * reload runs the new build), Electron quit-and-installs (or re-downloads
 * on macOS), Android downloads the APK and hands it to the system
 * installer.
 */
import { useUpdates } from "@/store/updates";
import { detectHost } from "@/lib/platform";
import { Button } from "@/ui/components/ui/button";
import { ProgressBar } from "@/ui/components/progress-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { RefreshCw } from "lucide-react";

function actionCopy(): { title: string; description: string; cta: string } {
  const host = detectHost();
  if (host === "electron") {
    return {
      title: "Update required",
      description:
        "This version can no longer reach the server. The new version installs when the app restarts.",
      cta: "Restart and update",
    };
  }
  if (host === "android") {
    return {
      title: "Update required",
      description:
        "This version can no longer reach the server. Install the latest version to continue.",
      cta: "Update app",
    };
  }
  return {
    title: "Update required",
    description:
      "A required update is ready to install. Reload the page to continue.",
    cta: "Reload now",
  };
}

export function UpdateDialog() {
  const requiredMinVersion = useUpdates((s) => s.requiredMinVersion);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const copy = actionCopy();
  const busy = status === "downloading";

  return (
    <Dialog open={!!requiredMinVersion}>
      <DialogContent
        className="max-w-sm"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        hideClose
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <RefreshCw className="size-5" aria-hidden />
          </div>
          <DialogHeader className="gap-1">
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
        </div>
        {busy && progress && (
          <ProgressBar
            percent={progress.percent}
            totalBytes={progress.totalBytes}
          />
        )}
        {status === "error" && (
          <p className="text-center text-xs text-muted-foreground">
            {detectHost() === "android"
              ? "If Android opened install settings, allow installs from this app, then try again. The first install also runs a Play Protect scan — this APK is the official Kataria Syntex release; choose Install anyway. Otherwise check your connection."
              : "Check your connection, then try again."}
          </p>
        )}
        <Button
          className="w-full"
          onClick={() => void installUpdate()}
          disabled={busy}
          loading={busy}
        >
          {busy ? "Downloading…" : copy.cta}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
