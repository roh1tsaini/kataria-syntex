/**
 * UpdateGate — the one undismissable surface (design.md Section 3.3): a bottom
 * sheet shown whenever the live server answered this build with
 * `426 update_required`. No close affordance, no outside dismiss: the API
 * carries no backward compatibility, so a client below the floor has nothing
 * useful to do until it updates.
 *
 * The action is the Android install path (staged APK → system installer),
 * owned by `platform/update-flow.ts`. While bytes stream, the sheet shows the
 * shared progress readout (`formatUpdateProgress`: percent · size); a failed
 * step shows its honest line from the same failure vocabulary the web uses.
 */
import { RefreshCw } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useUpdates, updateFailureCopy } from "@/platform/update-flow";

export function UpdateGate() {
  const requiredMinVersion = useUpdates((s) => s.requiredMinVersion);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const failure = useUpdates((s) => s.failure);
  const busy = status === "downloading" || status === "installing";

  return (
    <Sheet
      open={!!requiredMinVersion}
      hideClose
      dismissible={false}
      onClose={() => {}}
    >
      <View className="flex-row items-start gap-3">
        <View className="size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <RefreshCw size={20} className="text-primary" />
        </View>
        <SheetHeader className="flex-1">
          <SheetTitle>Update required</SheetTitle>
          <SheetDescription>
            This version can no longer reach the server. Install the latest
            version to continue.
          </SheetDescription>
        </SheetHeader>
      </View>

      {busy && progress ? (
        <ProgressBar
          className="mt-4"
          percent={progress.percent}
          totalBytes={progress.totalBytes}
        />
      ) : null}
      {status === "error" ? (
        <Text className="mt-4 text-center text-xs text-muted-foreground">
          {failure ? updateFailureCopy(failure) : "Tap to retry."}
        </Text>
      ) : null}
      <Button
        className="mt-5 w-full"
        label="Update app"
        onPress={() => void installUpdate()}
        loading={busy}
        disabled={busy}
      />
    </Sheet>
  );
}
