/**
 * Home — the shell's landing route. The business screens are still being
 * built; the web app renders the same empty band, so the phone matches.
 */
import { useWindowDimensions, View } from "react-native";

import { Page } from "@/components/page";

export default function HomeRoute() {
  const { height } = useWindowDimensions();
  return (
    <Page>
      <View style={{ minHeight: height * 0.6 }} />
    </Page>
  );
}
