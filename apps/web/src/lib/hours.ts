import { site } from "@/content/site";

/**
 * Whether the desk is open right now, in Asia/Kolkata, from the
 * machine-readable site.schedule. Returns a short label for the status
 * dot on the /links card.
 */
export type OpenStatus = { open: boolean; label: string };

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function kolkataMinutes(now: Date): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  let dayIndex = 0;
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "weekday")
      dayIndex = Math.max(
        0,
        DAY_SHORT.indexOf(part.value as (typeof DAY_SHORT)[number]),
      );
    if (part.type === "hour") hours = Number(part.value) % 24;
    if (part.type === "minute") minutes = Number(part.value);
  }
  return { dayIndex, minutes: hours * 60 + minutes };
}

const toMinutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

const toLabel = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export function openStatus(now: Date = new Date()): OpenStatus {
  const { dayIndex, minutes } = kolkataMinutes(now);

  const today = site.schedule[dayIndex];
  if (today) {
    if (minutes >= toMinutes(today.open) && minutes < toMinutes(today.close)) {
      return { open: true, label: `Open now · till ${toLabel(today.close)}` };
    }
    if (minutes < toMinutes(today.open)) {
      return { open: false, label: `Closed · opens ${toLabel(today.open)}` };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const next = site.schedule[(dayIndex + offset) % 7];
    if (!next) continue;
    const dayLabel =
      offset === 1 ? "tomorrow" : DAY_SHORT[(dayIndex + offset) % 7];
    return {
      open: false,
      label: `Closed · opens ${dayLabel} ${toLabel(next.open)}`,
    };
  }

  return { open: false, label: "Closed" };
}
