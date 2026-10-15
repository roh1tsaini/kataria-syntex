/**
 * QR-login approval route. `<origin>/login/scan/<code>` (the payload the
 * camera reads on another device) and `kataria://login/scan/<code>` both land
 * here through the manifest's intent filters.
 */
import { useLocalSearchParams } from "expo-router";

import { ScanApproveScreen } from "@/screens/scan-approve";

export default function ScanApproveRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ScanApproveScreen code={code ?? ""} />;
}
