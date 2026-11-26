type PeriodKind = "weekly" | "monthly";

// shortcut: fixed +09:00 offset, no historical DST, replace with Intl if dates before 1988 matter
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const THURSDAY = 4;
const WEEKDAYS = "일월화수목금토";

// Read the shifted instant with UTC accessors to get Seoul calendar fields.
function seoulClock(instant: Date): Date {
  return new Date(instant.getTime() + SEOUL_OFFSET_MS);
}

function fromSeoulClock(clock: Date): Date {
  return new Date(clock.getTime() - SEOUL_OFFSET_MS);
}

export function todaySeoul(now: Date): string {
  return seoulClock(now).toISOString().slice(0, 10);
}

export function periodFor(kind: PeriodKind, now: Date): { startsAt: Date; endsAt: Date } {
  const start = seoulClock(now);
  start.setUTCHours(0, 0, 0, 0);

  if (kind === "weekly") {
    const daysSinceThursday = (start.getUTCDay() - THURSDAY + 7) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceThursday);
    const startsAt = fromSeoulClock(start);
    return {
      startsAt,
      endsAt: new Date(startsAt.getTime() + 7 * DAY_MS),
    };
  }

  start.setUTCDate(1);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { startsAt: fromSeoulClock(start), endsAt: fromSeoulClock(end) };
}

export function nextPeriod(kind: PeriodKind, now: Date): { startsAt: Date; endsAt: Date } {
  return periodFor(kind, periodFor(kind, now).endsAt);
}

export function formatDeadline(instant: Date): string {
  const clock = seoulClock(instant);
  let time = clock.toISOString().slice(11, 16);
  if (clock.getTime() % DAY_MS === 0) {
    clock.setUTCDate(clock.getUTCDate() - 1);
    time = "24:00";
  }
  return `${clock.getUTCMonth() + 1}/${clock.getUTCDate()}(${WEEKDAYS[clock.getUTCDay()]}) ${time}`;
}

export function parseDeadlineInput({ date, time }: { date: string; time: string }): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(time)) {
    throw new RangeError("Expected a date in YYYY-MM-DD and a time from 00:00 to 24:00.");
  }

  const clock = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(clock.getTime()) || clock.toISOString().slice(0, 10) !== date) {
    throw new RangeError("Invalid calendar date.");
  }

  const [hours, minutes] = time.split(":").map(Number);
  clock.setUTCHours(hours, minutes);
  return fromSeoulClock(clock);
}
