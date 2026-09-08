/**
 * Form controls beyond the base kit — an inline-options select (the RN
 * counterpart of web's shadcn Select for fixed option sets: stock type,
 * unit presets, deniers), a multiline textarea, and the 44px icon-only
 * list-row action. Colors come from usePalette(); layout via className only.
 */

import { Pressable, Text, TextInput, View } from "react-native";
import { Feather, type FeatherIconName } from "@/ui/feather";
import { usePalette } from "@/theme";

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  invalid,
  disabled,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  const current = options.find((o) => o.value === value);
  return (
    <View
      className="min-h-[44px] flex-row flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5"
      style={{
        backgroundColor: p.card,
        borderColor: invalid ? p.destructive : p.input,
        opacity: disabled ? 0.5 : 1,
      }}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {!current && placeholder ? (
        <Text className="px-1 text-[13px]" style={{ color: p.mutedForeground }}>
          {placeholder}
        </Text>
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            className="min-h-[34px] justify-center rounded-md border px-2.5"
            style={({ pressed }) => ({
              backgroundColor: selected ? p.primary : "transparent",
              borderColor: selected ? p.primary : p.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              className="text-[13px] font-medium"
              style={{ color: selected ? p.primaryForeground : p.foreground }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Textarea(props: React.ComponentProps<typeof TextInput>) {
  const p = usePalette();
  return (
    <TextInput
      placeholderTextColor={p.mutedForeground}
      multiline
      textAlignVertical="top"
      className="min-h-[88px] rounded-lg border px-3 py-2.5 text-[15px]"
      style={{
        backgroundColor: p.card,
        borderColor: p.input,
        color: p.foreground,
      }}
      {...props}
    />
  );
}

/** 44px square icon-only action — edit/delete affordances in list rows. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  destructive,
}: {
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-lg"
      style={({ pressed }) => ({
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <Feather
        name={icon}
        size={18}
        color={destructive ? p.destructive : p.mutedForeground}
      />
    </Pressable>
  );
}
