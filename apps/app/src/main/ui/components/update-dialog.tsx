/**
 * Blocking update dialog — rendered once in App and shown whenever the
 * update store carries a requiredMinVersion (server 426 or published
 * minVersion). Undismissable by design: the API carries no backward
 * compatibility, so a client below the floor has nothing useful to do.
 *
 * The action follows the host: web reloads (the SW has already precached
 * the new build), Electron quit-and-installs (or re-downloads on macOS).
 */
import { useUpdates } from "@/store/updates";
import { detectHost } from "@/lib/platform";
import { formatUpdateProgress } from "@kataria-syntex/shared";
import { Button } from "@/ui/components/ui/button";
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
          <p
            className="text-center text-xs tabular-nums text-muted-foreground"
            role="status"
          >
            {formatUpdateProgress(progress)}
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
