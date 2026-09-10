/**
 * CountUp — the RN counterpart of apps/app's rolling-digit stat display
 * (design.md §2.4.2). The formatted string splits per character: digits ride
 * a 0–9 strip, separators and symbols (commas, decimals) stay fixed. Digits
 * key from the units side so a value change rolls the same column instead of
 * remounting it, and columns stagger 30ms from the units side (tail capped at
 * 120ms).
 *
 * Transform-only, memoized strips, mounted at zero so a first appearance
 * counts up from nothing. Display only — never inside inputs. Under
 * `prefers-reduced-motion` it renders the plain string.
 */

import { memo, useEffect } from "react";
import { Text, View, type TextStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/cn";
import { SPRING, useReduceMotion } from "@/lib/motion";

/** Shared 0–9 cells — one constant, never re-created or reconciled. */
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type StripStyle = {
  fontSize: number;
  cell: number;
  color: string;
  fontWeight: TextStyle["fontWeight"];
};

const RollingDigit = memo(function RollingDigit({
  digit,
  pos,
  reduce,
  strip,
}: {
  digit: number;
  pos: number;
  reduce: boolean;
  strip: StripStyle;
}) {
  const { fontSize, cell, color, fontWeight } = strip;
  const y = useSharedValue(0);

  useEffect(() => {
    const target = -digit * cell;
    y.value = reduce
      ? withTiming(target, { duration: 0 })
      : withDelay(Math.min(pos * 30, 120), withSpring(target, SPRING));
  }, [digit, pos, cell, reduce, y]);

  const roll = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <View style={{ height: cell, overflow: "hidden" }}>
      <Animated.View style={roll}>
        {DIGITS.map((d) => (
          <Text
            key={d}
            style={{
              fontSize,
              lineHeight: cell,
              height: cell,
              color,
              fontWeight,
              textAlign: "center",
            }}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

export function CountUp({
  target,
  format,
  fontSize,
  color,
  fontWeight = "700",
  className,
}: {
  target: number;
  format?: (value: number) => string;
  /** Size of the surrounding stat text — sets the digit strip cell height. */
  fontSize: number;
  color: string;
  fontWeight?: TextStyle["fontWeight"];
  className?: string;
}) {
  const reduce = useReduceMotion();
  const text = format
    ? format(target)
    : Math.round(target).toLocaleString("en-IN");

  if (reduce) {
    return (
      <Text
        className={cn("tabular-nums", className)}
        style={{ fontSize, color, fontWeight }}
      >
        {text}
      </Text>
    );
  }

  const chars = [...text];
  // Digit position from the right (units = 0) — stable across regroupings.
  const posFromRight: number[] = [];
  let seen = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    posFromRight[i] = /\d/.test(chars[i]) ? seen++ : -1;
  }

  const strip: StripStyle = {
    fontSize,
    cell: Math.round(fontSize * 1.2),
    color,
    fontWeight,
  };

  return (
    <View
      className={cn("flex-row items-start", className)}
      accessible
      accessibilityLabel={text}
    >
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <RollingDigit
            key={`d${posFromRight[i]}`}
            digit={Number(ch)}
            pos={posFromRight[i]}
            reduce={reduce}
            strip={strip}
          />
        ) : (
          <Text
            key={`s${i}-${ch}`}
            style={{
              fontSize,
              lineHeight: strip.cell,
              height: strip.cell,
              color,
              fontWeight,
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </Text>
        ),
      )}
    </View>
  );
}
