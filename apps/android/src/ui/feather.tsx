/**
 * Icon exports — the Feather font plus the lucide glyphs the web app uses
 * that Feather lacks (nav-config, dashboard, colors, stock, members). The lucide
 * components carry verbatim path data from the installed lucide-react
 * (24×24 viewBox, 2px stroke, round caps/joins), stroked with the caller's
 * color exactly as lucide uses currentColor.
 */

import type { ComponentType, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";

export { Feather };

export type FeatherIconName = keyof typeof Feather.glyphMap;

export type SvgIconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

function LucideIcon({
  size = 24,
  color = "currentColor",
  style,
  children,
}: SvgIconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </Svg>
  );
}

export function Scale(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M12 3v18" />
      <Path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
      <Path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
      <Path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
      <Path d="M7 21h10" />
    </LucideIcon>
  );
}

export function Factory(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M12 16h.01" />
      <Path d="M16 16h.01" />
      <Path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
      <Path d="M8 16h.01" />
    </LucideIcon>
  );
}

export function PackageOpen(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M12 22v-9" />
      <Path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z" />
      <Path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13" />
      <Path d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z" />
    </LucideIcon>
  );
}

export function Warehouse(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11" />
      <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z" />
      <Path d="M6 13h12" />
      <Path d="M6 17h12" />
    </LucideIcon>
  );
}

export function FlaskConical(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <Path d="M6.453 15h11.094" />
      <Path d="M8.5 2h7" />
    </LucideIcon>
  );
}

export function Palette(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <Circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <Circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <Circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <Circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
    </LucideIcon>
  );
}

export function Boxes(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
      <Path d="m7 16.5-4.74-2.85" />
      <Path d="m7 16.5 5-3" />
      <Path d="M7 16.5v5.17" />
      <Path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
      <Path d="m17 16.5-5-3" />
      <Path d="m17 16.5 4.74-2.85" />
      <Path d="M17 16.5v5.17" />
      <Path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
      <Path d="M12 8 7.26 5.15" />
      <Path d="m12 8 4.74-2.85" />
      <Path d="M12 13.5V8" />
    </LucideIcon>
  );
}

export function Receipt(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M12 17V7" />
      <Path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" />
      <Path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />
    </LucideIcon>
  );
}

export function Crown(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <Path d="M5 21h14" />
    </LucideIcon>
  );
}

export function ShieldCheck(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <Path d="m9 12 2 2 4-4" />
    </LucideIcon>
  );
}

// Web challans-detail not-found state uses lucide SearchX; Feather has no
// equivalent, so this carries its verbatim path data.
export function SearchX(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <Path d="m13.5 8.5-5 5" />
      <Path d="m8.5 8.5 5 5" />
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </LucideIcon>
  );
}

/** Either a Feather font glyph or a lucide-equivalent SVG component above —
 *  kit props take this so screens can pass the exact web glyph. */
export type IconValue = FeatherIconName | ComponentType<SvgIconProps>;

/** Renders an IconValue at one size/color — keeps every icon call site on a
 *  single prop instead of branching on string vs component. */
export function AppIcon({
  name,
  size = 16,
  color = "currentColor",
  style,
}: {
  name: IconValue;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (typeof name === "string") {
    return <Feather name={name} size={size} color={color} style={style} />;
  }
  const Custom = name;
  return <Custom size={size} color={color} style={style} />;
}
