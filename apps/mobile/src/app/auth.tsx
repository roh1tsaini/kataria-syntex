/**
 * Sign-in route (standalone — no shell chrome). `next` is the post-sign-in
 * destination: expo-router hands it over as a query param from either an https
 * deep link or a kataria:// link.
 */
import { useLocalSearchParams } from "expo-router";

import { RequireGuest } from "@/components/require-auth";
import { AuthScreen } from "@/screens/auth";

export default function AuthRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return (
    <RequireGuest next={next}>
      <AuthScreen next={next ?? null} />
    </RequireGuest>
  );
}
