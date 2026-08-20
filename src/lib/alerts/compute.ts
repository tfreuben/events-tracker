import { addDays, format, parseISO } from "date-fns";
import type { TFEvent } from "@/types";
import { CADENCE, type Touchpoint } from "./cadence";

export interface DueTouchpoint {
  event: TFEvent;
  touchpoint: Touchpoint;
  dueDate: string;
}

const TERMINAL_STATUSES = new Set(["Cancelled", "Not Attending"]);

// Don't backfill touchpoints whose fire date is more than this far in the past.
// Prevents a thundering herd of stale alerts the first time the scheduler runs.
const MAX_LOOKBACK_DAYS = 3;

function toIsoDateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  if (typeof value === "string") return value.substring(0, 10);
  return null;
}

export function computeDueTouchpoints(
  today: string,
  events: TFEvent[],
  alreadySent: Set<string>
): DueTouchpoint[] {
  const todayDate = parseISO(today);
  const lookbackCutoff = addDays(todayDate, -MAX_LOOKBACK_DAYS);
  const due: DueTouchpoint[] = [];

  for (const event of events) {
    const startStr = toIsoDateString(event.start_date);
    if (!startStr) continue;
    if (TERMINAL_STATUSES.has(event.status)) continue;
    const start = parseISO(startStr);

    for (const touchpoint of CADENCE) {
      const fireDate = addDays(start, touchpoint.offsetDays);
      if (fireDate.getTime() > todayDate.getTime()) continue;
      if (fireDate.getTime() < lookbackCutoff.getTime()) continue;

      const key = `${event.id}:${touchpoint.code}`;
      if (alreadySent.has(key)) continue;

      due.push({
        event,
        touchpoint,
        dueDate: format(fireDate, "yyyy-MM-dd"),
      });
    }
  }

  return due;
}

export function computeUpcomingWindow(
  today: string,
  windowDays: number,
  events: TFEvent[],
  alreadySent: Set<string>
): DueTouchpoint[] {
  const todayDate = parseISO(today);
  const windowEnd = addDays(todayDate, windowDays);
  const lookbackCutoff = addDays(todayDate, -MAX_LOOKBACK_DAYS);
  const upcoming: DueTouchpoint[] = [];

  for (const event of events) {
    const startStr = toIsoDateString(event.start_date);
    if (!startStr) continue;
    if (TERMINAL_STATUSES.has(event.status)) continue;
    const start = parseISO(startStr);

    for (const touchpoint of CADENCE) {
      const fireDate = addDays(start, touchpoint.offsetDays);
      if (fireDate.getTime() > windowEnd.getTime()) continue;
      if (fireDate.getTime() < lookbackCutoff.getTime()) continue;
      if (alreadySent.has(`${event.id}:${touchpoint.code}`)) continue;

      upcoming.push({
        event,
        touchpoint,
        dueDate: format(fireDate, "yyyy-MM-dd"),
      });
    }
  }

  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return upcoming;
}
