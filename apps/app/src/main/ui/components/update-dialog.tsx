/**
 * Blocking update dialog — rendered once in App and shown whenever the
 * update store carries a requiredMinVersion from the live server's 426.
 * Undismissable by design: the API carries
 * no backward compatibility, so a client below the floor has nothing useful
 * to do.
 *
 * The action AND the copy come from the host's update action
 * (`updateAction()` in lib/platform.ts): web reloads (index.html
 * revalidates, so the reload runs the new build), Windows/Linux restart into
 * the silently staged build, macOS downloads the published dmg through the
 * OS browser, Android hands the staged APK to the system installer. Nothing
 * here branches on platform.
 *
 * A failed attempt explains itself: the store's `failure` names the step
 * that failed, so a release that is not published yet never reads as "no
 * network".
 */
import { UPDATE_FAILURE_COPY, useUpdates } from "@/store/updates";
import { updateAction, type UpdateAction } from "@/lib/platform";
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

/** One line per host: what the tap does, and therefore what it must say. */
const COPY: Record<UpdateAction, { description: string; cta: string }> = {
  reload: {
    description:
      "A required update is ready to install. Reload the page to continue.",
    cta: "Reload now",
  },
  restart: {
    description:
      "This version can no longer reach the server. The new version installs when the app restarts.",
    cta: "Restart and update",
  },
  download: {
    description:
      "This version can no longer reach the server. Download the new version to continue.",
    cta: "Download update",
  },
  install: {
    description:
      "This version can no longer reach the server. Install the latest version to continue.",
    cta: "Update app",
  },
};

export function UpdateDialog() {
  const requiredMinVersion = useUpdates((s) => s.requiredMinVersion);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const failure = useUpdates((s) => s.failure);
  const action = updateAction();
  const copy = COPY[action];
  const busy = status === "downloading" || status === "installing";

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
            <DialogTitle>Update required</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
        </div>
        {status === "downloading" && progress && (
          <ProgressBar
            percent={progress.percent}
            totalBytes={progress.totalBytes}
          />
        )}
        {status === "error" && (
          <p className="text-center text-xs text-muted-foreground">
            {failure ? UPDATE_FAILURE_COPY[failure] : "Tap to retry."}
          </p>
        )}
        <Button
          className="w-full"
          onClick={() => void installUpdate()}
          disabled={busy}
          loading={busy}
        >
          {copy.cta}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
