/**
 * Sales challans tab — the phone port of apps/app's /challans register
 * (type="sales"): search, FY filter, offline-pending flags, pagination,
 * new-challan action gated by create_challan. Chrome comes from ChallanList.
 */

import { Redirect } from "expo-router";
import { useAuth } from "@kataria-syntex/app-core";
import { ChallanList } from "@/ui/challan-list";
import { SALES_KIND } from "@/lib/challan-kinds";

export default function ChallansTab() {
  const status = useAuth((s) => s.status);
  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  return <ChallanList kind={SALES_KIND} />;
}
