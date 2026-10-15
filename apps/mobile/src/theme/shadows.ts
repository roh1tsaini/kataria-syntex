/**
 * Platform shadows — the RN mirror of the three CSS shadow tokens in
 * globals.css (`--shadow-soft`, `--shadow-lift`, `--shadow-overlay`).
 *
 * React Native paints one shadow per view, so each token's two CSS layers
 * collapse into a single approximation with the same offset, blur and overall
 * opacity. Android additionally needs `elevation`; both keys are set so one
 * style object works on every platform.
 */
import type { ViewStyle } from "react-native";

export const shadowSoft: ViewStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

export const shadowLift: ViewStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
};

export const shadowOverlay: ViewStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};
