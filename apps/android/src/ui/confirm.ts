/**
 * Confirm primitive — the RN counterpart of apps/app's confirm-dialog:
 * a promise-based native alert with the same options shape, so screens
 * ported from web keep their exact copy and flow (delete confirms, the
 * discard-changes guard).
 */

import { Alert } from "react-native";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.description,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: options.confirmLabel ?? "OK",
          style: options.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Discard guard for modal editors — the port of web's useDialogDiscard.
 * Clean or busy forms close at once; dirty forms confirm first. Wire it to
 * the modal's Cancel button and onRequestClose; post-save closes bypass it.
 */
export function requestDiscard(
  dirty: boolean,
  busy: boolean,
  close: () => void,
): void {
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
}
