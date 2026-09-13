/**
 * Form controls beyond the base kit — an inline-options select (the RN
 * counterpart of web's shadcn Select for fixed option sets: stock type,
 * unit presets, deniers), a multiline textarea, and the 44px icon-only
 * list-row action. Colors come from usePalette(); layout via className only.
 */

import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Feather, type FeatherIconName } from "@/ui/feather";
import { MorphSheet } from "@/ui/morph-sheet";
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
      className="min-h-[44px] flex-row flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5"
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
            className="min-h-[44px] min-w-[44px] justify-center rounded-md border px-2.5"
            style={({ pressed }) => ({
              backgroundColor: selected ? p.primary : "transparent",
              borderColor: selected ? p.primary : p.border,
              opacity: pressed ? 0.8 : 1,
              transform: pressed ? [{ scale: 0.97 }] : [{ scale: 1 }],
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
      className="min-h-[88px] rounded-md border px-3 py-2.5 text-[15px]"
      style={{
        backgroundColor: p.card,
        borderColor: p.input,
        color: p.foreground,
      }}
      {...props}
    />
  );
}

/** 44px circular icon-only action — edit/delete affordances in list rows.
 *  design.md §2.7: a lone icon action is a circle, transparent at rest and
 *  tinted on press (hover on pointers), pressing down to scale(0.9). */
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
      className="h-11 w-11 items-center justify-center rounded-full border"
      style={({ pressed }) => ({
        borderColor: pressed ? "transparent" : p.border,
        backgroundColor: pressed ? p.muted : "transparent",
        opacity: disabled ? 0.5 : 1,
        transform: pressed && !disabled ? [{ scale: 0.9 }] : [{ scale: 1 }],
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

/**
 * MenuSelect — the RN counterpart of web's shadcn Select for open-ended
 * option sets: a 44px trigger that opens a bottom-sheet list. This is the
 * control used for filters and long option sets; the inline `Select` above
 * stays for tiny fixed sets (stock type, etc.).
 */
export function MenuSelect({
  value,
  options,
  onChange,
  placeholder,
  leadingIcon,
  disabled,
  invalid,
  accessibilityLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  leadingIcon?: FeatherIconName;
  disabled?: boolean;
  invalid?: boolean;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const p = usePalette();
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true, expanded: open }}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className="min-h-[44px] flex-row items-center gap-1.5 rounded-md border px-3"
        style={({ pressed }) => ({
          backgroundColor: p.card,
          borderColor: invalid ? p.destructive : p.input,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        })}
      >
        {leadingIcon ? (
          <Feather name={leadingIcon} size={16} color={p.mutedForeground} />
        ) : null}
        <Text
          className="min-w-0 flex-1 text-[15px] font-medium"
          numberOfLines={1}
          style={{ color: current ? p.foreground : p.mutedForeground }}
        >
          {current ? current.label : placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={p.mutedForeground} />
      </Pressable>
      <MorphSheet
        open={open}
        onOpenChange={setOpen}
        title={accessibilityLabel ?? placeholder}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
        >
          {options.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: o.value === value }}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="min-h-[44px] flex-row items-center justify-between border-b px-4 py-3"
              style={({ pressed }) => ({
                borderColor: p.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                className="flex-1 text-[15px]"
                style={{ color: p.foreground }}
              >
                {o.label}
              </Text>
              {o.value === value ? (
                <Feather name="check" size={18} color={p.primary} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </MorphSheet>
    </>
  );
}
