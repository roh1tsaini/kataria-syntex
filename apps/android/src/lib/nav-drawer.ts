/**
 * Nav drawer open-state — the Android counterpart of apps/app's `mobileOpen`
 * shell state. Held in a store (not Screen state) because the trigger lives in
 * the header while the drawer is mounted once at the root, above every route.
 */

import { create } from "zustand";

type NavDrawerState = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggle: () => void;
};

export const useNavDrawer = create<NavDrawerState>()((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
