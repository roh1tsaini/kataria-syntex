/**
 * Shell layout — every signed-in route renders inside the phone shell
 * (floating menu circle, bottom capsule, drawer, offline strip, toasts).
 */
import { Slot } from "expo-router";

import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";

export default function ShellLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Slot />
      </AppShell>
    </RequireAuth>
  );
}
