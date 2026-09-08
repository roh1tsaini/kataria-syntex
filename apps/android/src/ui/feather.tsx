/** Feather glyph name alias — one import site for icon-only components. */

import { Feather } from "@expo/vector-icons";

export { Feather };

export type FeatherIconName = keyof typeof Feather.glyphMap;
