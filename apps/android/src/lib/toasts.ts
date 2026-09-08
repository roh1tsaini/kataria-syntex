import { ToastAndroid } from "react-native";
import { configureToasts } from "@kataria-syntex/app-core";

/** Native toast host wired into app-core's sink. Long durations: the sync
 * engine raises one toast per synced challan batch. */
export function configureAndroidToasts(): void {
  configureToasts({
    success: (title, description) => {
      ToastAndroid.show(
        description ? `${title}\n${description}` : title,
        ToastAndroid.LONG,
      );
    },
    error: (title, description) => {
      ToastAndroid.show(
        description ? `${title}\n${description}` : title,
        ToastAndroid.LONG,
      );
    },
  });
}
