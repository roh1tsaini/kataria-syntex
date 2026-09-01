/**
 * Challans — route components live in focused modules; this file re-exports
 * the surface App.tsx and outward.tsx consume. Keep lazy imports in App.tsx
 * pointing at "@/ui/pages/challans" so code-splitting stays per-route.
 */
import { ChallanListPage } from "./challans-list";
import { ChallanEditorRoute } from "./challans-editor";
import { ChallanDetailRoute } from "./challans-detail";
import { ChallanPrintRoute } from "./challans-print";
import { OUTWARD_KIND, SALES_KIND, type ChallanKind } from "./challans-shared";

export { ChallanListPage };
export { ChallanEditorRoute, ChallanDetailRoute, ChallanPrintRoute };
export { OUTWARD_KIND, SALES_KIND };
export type { ChallanKind };

export function ChallansPage() {
  return <ChallanListPage kind={SALES_KIND} />;
}

export function ChallanEditorPage() {
  return <ChallanEditorRoute kind={SALES_KIND} />;
}

export function ChallanDetailPage() {
  return <ChallanDetailRoute kind={SALES_KIND} />;
}

export function ChallanPrintPage() {
  return <ChallanPrintRoute kind={SALES_KIND} />;
}
