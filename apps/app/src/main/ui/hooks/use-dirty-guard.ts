import { useCallback, useEffect } from "react";
import type { ConfirmOptions } from "@/ui/components/confirm-dialog";

/**
 * Warns before closing/reloading the tab while unsaved edits exist.
 * Tab-close coverage only: dialog dismissal (Escape, overlay click, Cancel)
 * never fires beforeunload, so dialog editors (masters, colors) guard their
 * own close path with useDialogDiscard below instead.
 */
export function useDirtyGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/**
 * Discard guard for dialog editors. Returns a close-request handler: clean
 * or saving forms close at once, dirty forms confirm "Discard changes?"
 * first (existing confirm primitive — no new dialog pattern). Wire it to
 * the dialog's onOpenChange + Cancel; post-save closes bypass it.
 */
export function useDialogDiscard(
  dirty: boolean,
  busy: boolean,
  confirm: (options: ConfirmOptions) => Promise<boolean>,
): (close: () => void) => void {
  return useCallback(
    (close: () => void) => {
      if (!dirty || busy) {
        close();
        return;
      }
      void confirm({
        title: "Discard changes?",
        description: "Your edits will be lost.",
        confirmLabel: "Discard",
      }).then((ok) => {
        if (ok) close();
      });
    },
    [dirty, busy, confirm],
  );
}
