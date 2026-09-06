import { Check, Palette } from "lucide-react";
import { ACCENTS, useAccent } from "@/ui/hooks/use-theme";
import { CircleButton } from "@/ui/components/ui/circle-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { cn } from "@/ui/lib/cn";

/** Header control for picking the app accent (persisted; drives all primary/accent tokens). */
export function AccentPicker({ size }: { size?: "md" | "touch" }) {
  const { accent, setAccent } = useAccent();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CircleButton
          size={size}
          aria-label="Change accent colour"
          title="Change accent colour"
        >
          <Palette aria-hidden />
        </CircleButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11.5rem]">
        <DropdownMenuLabel>Accent</DropdownMenuLabel>
        {ACCENTS.map((a) => {
          const active = a.id === accent;
          return (
            <DropdownMenuItem
              key={a.id}
              onSelect={() => setAccent(a.id)}
              aria-pressed={active}
              className="font-medium"
            >
              {/* Equal-size swatches; the selected one carries the accent ring */}
              <span
                className={cn(
                  "size-4 shrink-0 rounded-full ring-1 ring-border ring-inset",
                  active && "ring-2 ring-ring",
                )}
                style={{ backgroundColor: a.swatch }}
                aria-hidden
              />
              <span className="flex-1">{a.label}</span>
              {active && <Check aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
