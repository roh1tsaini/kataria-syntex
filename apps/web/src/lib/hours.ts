import { site } from "@/content/site";

/**
 * Computes whether the desk is open right now, in Asia/Kolkata, from the
 * human-readable entries in site.hours. Returns a short label for the
 * status dot on the /links card.
 */
export type OpenStatus = { open: boolean; label: string };

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseClock(text: string): number {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + Number(match[2]);
}

function entryForDay(dayIndex: number) {
  const dayName = DAY_NAMES[dayIndex];
  return site.hours.find((entry) => {
    const [start, end] = entry.days.split("–").map((part) => part.trim());
    if (!end) return start === dayName;
    const startIndex = DAY_NAMES.indexOf(start as (typeof DAY_NAMES)[number]);
    const endIndex = DAY_NAMES.indexOf(end as (typeof DAY_NAMES)[number]);
    return dayIndex >= startIndex && dayIndex <= endIndex;
  });
}

interface TimePoint {
  dayIndex: number;
  hours: number;
  minutes: number;
}

function getKolkataTime(now: Date = new Date()): TimePoint {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let weekdayStr = "";
  let hours = 0;
  let minutes = 0;

  for (const part of parts) {
    if (part.type === "weekday") weekdayStr = part.value;
    if (part.type === "hour") hours = Number(part.value) % 24;
    if (part.type === "minute") minutes = Number(part.value);
  }

  const dayIndex = DAY_SHORT.indexOf(weekdayStr as (typeof DAY_SHORT)[number]);
  return { dayIndex: dayIndex >= 0 ? dayIndex : 0, hours, minutes };
}

export function openStatus(
  input: Date | TimePoint = getKolkataTime(),
): OpenStatus {
  const { dayIndex, hours, minutes } =
    input instanceof Date ? getKolkataTime(input) : input;
  const nowMinutes = hours * 60 + minutes;

  const today = entryForDay(dayIndex);
  if (today && today.time !== "Closed") {
    const [openText, closeText] = today.time.split("–").map((p) => p.trim());
    const open = parseClock(openText);
    const close = parseClock(closeText);
    if (nowMinutes >= open && nowMinutes < close) {
      return { open: true, label: `Open now · till ${closeText}` };
    }
    if (nowMinutes < open) {
      return { open: false, label: `Closed · opens ${openText}` };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDayIndex = (dayIndex + offset) % 7;
    const entry = entryForDay(nextDayIndex);
    if (!entry || entry.time === "Closed") continue;
    const [openText] = entry.time.split("–").map((p) => p.trim());
    const dayLabel = offset === 1 ? "tomorrow" : DAY_SHORT[nextDayIndex];
    return { open: false, label: `Closed · opens ${dayLabel} ${openText}` };
  }

  return { open: false, label: "Closed" };
}
