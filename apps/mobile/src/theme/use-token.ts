/**
 * Reads a theme token as a plain color string.
 *
 * Icons and a few native props (placeholder color, selection color, status bar)
 * need an actual value rather than a class name, and `useUnstableNativeVariable`
 * is NativeWind's supported door to one.
 */
import { useUnstableNativeVariable } from "nativewind";

export function useToken(name: `--${string}`): string {
  const value = useUnstableNativeVariable(name) as unknown;
  return typeof value === "string" && value.length > 0 ? value : "#000000";
}
