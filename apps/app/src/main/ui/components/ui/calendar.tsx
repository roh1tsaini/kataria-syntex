import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/ui/lib/cn";
import { Button } from "@/ui/components/ui/button";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDateStr(str?: string): Date | null {
  if (!str) return null;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type CalendarProps = {
  value?: string; // YYYY-MM-DD
  onChange?: (dateStr: string) => void;
  minDate?: string;
  maxDate?: string;
  className?: string;
};

export function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  className,
}: CalendarProps) {
  const selectedDate = React.useMemo(() => parseDateStr(value), [value]);
  const min = React.useMemo(() => parseDateStr(minDate), [minDate]);
  const max = React.useMemo(() => parseDateStr(maxDate), [maxDate]);

  const [viewDate, setViewDate] = React.useState<Date>(
    () => selectedDate ?? new Date(),
  );

  React.useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [selectedDate]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const prevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Generate calendar grid
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Days from previous month
  const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();
  const leadingDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    leadingDays.push({
      date: new Date(currentYear, currentMonth - 1, prevMonthDaysCount - i),
      isCurrentMonth: false,
    });
  }

  // Days of current month
  const currentDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    currentDays.push({
      date: new Date(currentYear, currentMonth, d),
      isCurrentMonth: true,
    });
  }

  // Trailing days from next month to complete 35 or 42 grid cells
  const totalCellsSoFar = leadingDays.length + currentDays.length;
  const targetCells = totalCellsSoFar > 35 ? 42 : 35;
  const trailingDaysCount = targetCells - totalCellsSoFar;
  const trailingDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  for (let d = 1; d <= trailingDaysCount; d++) {
    trailingDays.push({
      date: new Date(currentYear, currentMonth + 1, d),
      isCurrentMonth: false,
    });
  }

  const allDays = [...leadingDays, ...currentDays, ...trailingDays];

  const todayStr = formatDateStr(new Date());

  const isDateDisabled = (d: Date) => {
    const dStr = formatDateStr(d);
    if (minDate && dStr < minDate) return true;
    if (maxDate && dStr > maxDate) return true;
    return false;
  };

  return (
    <div className={cn("w-80 sm:w-72 select-none p-1 space-y-3", className)}>
      {/* Month / Year header */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 sm:size-8 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="text-sm font-semibold text-foreground">
          {MONTHS[currentMonth]} {currentYear}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-10 sm:size-8 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {allDays.map(({ date, isCurrentMonth }, idx) => {
          const dateStr = formatDateStr(date);
          const isSelected = value === dateStr;
          const isToday = dateStr === todayStr;
          const disabled = isDateDisabled(date);

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled && onChange) {
                  onChange(dateStr);
                }
              }}
              className={cn(
                "relative flex size-10 sm:size-8 items-center justify-center rounded-md text-xs transition-colors outline-none",
                !isCurrentMonth && "text-muted-foreground/40",
                isCurrentMonth &&
                  !isSelected &&
                  "text-foreground hover:bg-muted",
                isSelected && "bg-foreground text-background font-medium",
                isToday &&
                  !isSelected &&
                  "border border-foreground font-medium",
                disabled && "cursor-not-allowed opacity-30 pointer-events-none",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Quick Jump Action */}
      <div className="flex items-center justify-between border-t border-border/60 pt-2 px-1 text-xs">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            const today = formatDateStr(new Date());
            setViewDate(new Date());
            onChange?.(today);
          }}
        >
          Today
        </Button>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange?.("")}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
