/**
 * Job-work challans tab — the phone port of apps/app's /outward register
 * (type="outward"): same list as sales, party label = job worker, no rates.
 */

import { Redirect } from "expo-router";
import { useAuth } from "@kataria-syntex/app-core";
import { ChallanList } from "@/ui/challan-list";
import { OUTWARD_KIND } from "@/lib/challan-kinds";

export default function OutwardTab() {
  const status = useAuth((s) => s.status);
  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  return <ChallanList kind={OUTWARD_KIND} />;
}
