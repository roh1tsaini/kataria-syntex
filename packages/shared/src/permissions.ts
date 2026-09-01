export const ALL_PERMISSIONS = [
  "create_challan",
  "edit_challan",
  "delete_challan",
  "create_return",
  "edit_return",
  "create_raw_material",
  "edit_raw_material",
  "create_packing",
  "edit_packing",
  "manage_masters",
  "view_stock",
  "view_reports",
  "manage_members",
  "manage_settings",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];
