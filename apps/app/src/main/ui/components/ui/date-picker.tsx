import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/ui/lib/cn";
import { fmtDate } from "@/ui/lib/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/components/ui/popover";
import { Calendar } from "@/ui/components/ui/calendar";

export type DatePickerProps = {
  id?: string;
  value?: string; // YYYY-MM-DD
  onChange?: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
  clearable?: boolean;
};

function formatDisplay(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return dateStr;
  return fmtDate(
    `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`,
  );
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  minDate,
  maxDate,
  className,
  clearable = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const display = formatDisplay(value);

  const handleSelect = (nextValue: string) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn("relative inline-flex w-full items-center", className)}
      >
        <PopoverTrigger
          id={id}
          disabled={disabled}
          className={cn(
            "field-control flex h-11 sm:h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-left text-sm font-normal text-foreground transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0 truncate">
            <CalendarIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">{display || placeholder}</span>
          </span>
        </PopoverTrigger>

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.("");
            }}
            className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-2 sm:size-8"
            aria-label="Clear date"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <PopoverContent align="start" className="p-2">
        <Calendar
          value={value}
          onChange={handleSelect}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}
