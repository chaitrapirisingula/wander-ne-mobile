export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTH_NAMES = [
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

/** Parse date strings like "5/12/2026" as local calendar date (U.S. M/D/Y). */
export function parseEventDateString(str: unknown): Date | null {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  const parts = trimmed.split(/[-/]/).map((p) => p.trim());
  if (parts.length !== 3) return null;
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!y || Number.isNaN(y)) return null;
  if (a <= 12 && b <= 31) {
    const d = new Date(y, a - 1, b);
    if (
      d.getFullYear() === y &&
      d.getMonth() === a - 1 &&
      d.getDate() === b
    ) {
      return d;
    }
  }
  return null;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Shorten "10:00:00 AM" → "10:00 AM" when possible. */
export function formatTimeDisplay(time: unknown): string | null {
  if (!time || typeof time !== "string") return null;
  const t = time.trim();
  const m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (m) return `${m[1]}:${m[2]} ${m[4].toUpperCase()}`;
  return t;
}

export interface AgendaEvent {
  id: string;
  date?: string;
  time?: string;
  name?: string;
  site?: string;
  description?: string;
}

export function eventDayKey(ev: AgendaEvent): string {
  const d = parseEventDateString(ev.date);
  if (d) return dateKey(d);
  return `__${ev.date || "unknown"}__${ev.id || ""}`;
}

export type CalendarCell =
  | { type: "pad"; key: string }
  | { type: "day"; date: Date; key: string };

export function buildMonthCells(viewYear: number, viewMonth: number): CalendarCell[] {
  const first = new Date(viewYear, viewMonth, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ type: "pad", key: `pad-start-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    cells.push({ type: "day", date: d, key: dateKey(d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ type: "pad", key: `pad-end-${cells.length}` });
  }
  return cells;
}

export function chunkCells<T>(cells: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < cells.length; i += size) {
    rows.push(cells.slice(i, i + size));
  }
  return rows;
}
