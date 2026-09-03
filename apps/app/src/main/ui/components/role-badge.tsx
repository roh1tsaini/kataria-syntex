import { Crown, ShieldCheck } from "lucide-react";
import { Badge } from "@/ui/components/ui/badge";

const PERMISSION_LABELS: Record<string, string> = {
  create_challan: "Create Challans",
  edit_challan: "Edit Challans",
  delete_challan: "Delete Challans",
  create_return: "Create Returns",
  edit_return: "Edit Returns",
  create_raw_material: "Create Raw Material",
  edit_raw_material: "Edit Raw Material",
  create_packing: "Create Packing",
  edit_packing: "Edit Packing",
  manage_masters: "Manage Masters",
  view_stock: "View Stock",
  view_reports: "View Reports",
  manage_members: "Manage Members",
  manage_settings: "Manage Settings",
};

export function permissionLabel(perm: string): string {
  return PERMISSION_LABELS[perm] ?? perm;
}

export function roleBadge(isPrimaryAdmin?: boolean) {
  if (isPrimaryAdmin === undefined) return null;
  if (isPrimaryAdmin) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 whitespace-nowrap gap-1 border-primary/25 bg-primary/10 text-primary"
      >
        <Crown className="size-3" aria-hidden />
        Primary Admin
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 whitespace-nowrap gap-1 border-warning/25 bg-warning/10 text-warning"
    >
      <ShieldCheck className="size-3" aria-hidden />
      Member
    </Badge>
  );
}
