import {
  ChallanDetailRoute,
  ChallanEditorRoute,
  ChallanListPage,
  ChallanPrintRoute,
  OUTWARD_KIND,
} from "@/ui/pages/challans";

export function OutwardChallansPage() {
  return <ChallanListPage kind={OUTWARD_KIND} />;
}

export function OutwardChallanEditorPage() {
  return <ChallanEditorRoute kind={OUTWARD_KIND} />;
}

export function OutwardChallanDetailPage() {
  return <ChallanDetailRoute kind={OUTWARD_KIND} />;
}

export function OutwardChallanPrintPage() {
  return <ChallanPrintRoute kind={OUTWARD_KIND} />;
}
