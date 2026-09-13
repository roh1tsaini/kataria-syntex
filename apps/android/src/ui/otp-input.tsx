/**
 * OTP cell row — the RN counterpart of apps/app's InputOTP on the auth code
 * step. Six adjacent 44px cells share hairline borders (first/last corners
 * rounded, active cell border brightened), typing advances, pasting or SMS
 * autofill fills forward, backspace steps back — the web input-otp behavior.
 */

import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { usePalette, withAlpha } from "@/theme";

const LENGTH = 6;

function toSlots(value: string): string[] {
  return Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");
}

export function OtpInput({
  value,
  onChange,
  onSubmit,
  invalid,
  autoFocus,
  label = "Verification code",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Enter on a hardware/soft keyboard submit key (web form submit). */
  onSubmit?: () => void;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const p = usePalette();
  const refs = useRef<Array<TextInput | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);
  // Cells live in local state: a gap in the middle must not shift the digits
  // that sit after it (joining values would compress them).
  const [slots, setSlots] = useState<string[]>(() => toSlots(value));

  // Web InputOTP is controlled: resync when the parent changes the value
  // from outside (e.g. clears it). Echoes of our own edits match the slots
  // and no-op, so in-progress typing is never disturbed.
  useEffect(() => {
    if (value !== slots.join("")) setSlots(toSlots(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: string[]) => {
    setSlots(next);
    onChange(next.join(""));
  };

  const handleChange = (index: number, text: string) => {
    const clean = text.replace(/\D/g, "");
    const next = slots.slice();
    if (!clean) {
      next[index] = "";
      update(next);
      return;
    }
    // A multi-char value is a paste/autofill, or the typed digit appended
    // after the cell's existing char (Android keeps the cursor at the end).
    const current = next[index] ?? "";
    const appended = clean.length > 1 && current && clean.startsWith(current);
    const chars = appended ? clean.slice(current.length) : clean;
    const start = appended ? index + current.length : index;
    if (chars.length === 1 && start === index) {
      next[index] = chars;
      update(next);
      if (index < LENGTH - 1) refs.current[index + 1]?.focus();
      return;
    }
    for (let i = 0; i < chars.length && start + i < LENGTH; i += 1) {
      next[start + i] = chars[i];
    }
    update(next);
    refs.current[Math.min(start + chars.length, LENGTH - 1)]?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key !== "Backspace" || slots[index] || index === 0) return;
    const next = slots.slice();
    next[index - 1] = "";
    update(next);
    refs.current[index - 1]?.focus();
  };

  return (
    <View className="flex-row self-center">
      {Array.from({ length: LENGTH }).map((_, i) => {
        const active = focused === i && !invalid;
        const edge = invalid ? p.destructive : p.input;
        return (
          <TextInput
            key={i}
            ref={(node) => {
              refs.current[i] = node;
            }}
            value={slots[i] ?? ""}
            onChangeText={(text) => handleChange(i, text)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused((f) => (f === i ? null : f))}
            onSubmitEditing={() => {
              if (slots.join("").length === LENGTH) onSubmit?.();
            }}
            autoFocus={autoFocus && i === 0}
            selectTextOnFocus
            keyboardType="number-pad"
            maxLength={LENGTH}
            autoComplete={i === 0 ? "sms-otp" : "off"}
            accessibilityLabel={`${label}, digit ${i + 1}`}
            className="h-11 w-11 p-0 text-center text-base font-semibold"
            style={[
              {
                backgroundColor: p.card,
                color: invalid ? p.destructive : p.foreground,
                fontVariant: ["tabular-nums"],
                borderWidth: 1,
                borderColor: active ? withAlpha(p.foreground, 0.4) : edge,
                marginLeft: i > 0 ? -1 : 0,
                borderTopLeftRadius: i === 0 ? 10 : 0,
                borderBottomLeftRadius: i === 0 ? 10 : 0,
                borderTopRightRadius: i === LENGTH - 1 ? 10 : 0,
                borderBottomRightRadius: i === LENGTH - 1 ? 10 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}
