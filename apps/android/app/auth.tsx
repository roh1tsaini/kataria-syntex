import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@kataria-syntex/app-core";
import { AuthScreen } from "@/ui/auth-screen";

export default function AuthRoute() {
  const status = useAuth((s) => s.status);
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const rawReturnTo = params.returnTo ?? "/";
  const candidate = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  // Only allow the internal QR approval continuation; never turn a query
  // parameter into an arbitrary navigation/open-redirect surface.
  const returnTo =
    candidate && candidate.startsWith("/login/scan/") ? candidate : "/";
  if (status === "authed") return <Redirect href={returnTo || "/"} />;
  return <AuthScreen returnTo={returnTo} />;
}
