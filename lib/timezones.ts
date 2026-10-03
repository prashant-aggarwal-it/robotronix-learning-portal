import type { WeeklyScheduleSlot } from "./types";

export const IST_TIMEZONE = "Asia/Kolkata";

// Popular shortcuts stay near the top of the selector, but they are NOT the
// only supported zones. The UI expands this list with Intl.supportedValuesOf
// so any valid IANA timezone available in the browser can be selected.
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India · Delhi / Mumbai · IST" },
  { value: "Asia/Dubai", label: "UAE · Dubai / Abu Dhabi · GST" },
  { value: "Europe/London", label: "United Kingdom · London" },
  { value: "America/New_York", label: "US / Canada Eastern · New York / Toronto" },
  { value: "America/Chicago", label: "US Central · Chicago" },
  { value: "America/Denver", label: "US Mountain · Denver" },
  { value: "America/Phoenix", label: "US Arizona · Phoenix · no DST" },
  { value: "America/Los_Angeles", label: "US / Canada Pacific · Los Angeles / Vancouver" },
  { value: "America/Anchorage", label: "US Alaska · Anchorage" },
  { value: "Pacific/Honolulu", label: "US Hawaii · Honolulu" },
  { value: "America/Halifax", label: "Canada Atlantic · Halifax" },
  { value: "America/St_Johns", label: "Canada Newfoundland · St. John’s" },
  { value: "Europe/Berlin", label: "Central Europe · Germany / France / Netherlands" },
  { value: "Asia/Riyadh", label: "Saudi Arabia · Riyadh · AST" },
  { value: "Asia/Qatar", label: "Qatar · Doha" },
  { value: "Asia/Muscat", label: "Oman · Muscat" },
  { value: "Asia/Singapore", label: "Singapore · SGT" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia · Kuala Lumpur" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Shanghai", label: "China · Beijing / Shanghai" },
  { value: "Asia/Tokyo", label: "Japan · Tokyo · JST" },
  { value: "Asia/Seoul", label: "South Korea · Seoul" },
  { value: "Australia/Sydney", label: "Australia Eastern · Sydney / Melbourne" },
  { value: "Australia/Adelaide", label: "Australia Central · Adelaide" },
  { value: "Australia/Perth", label: "Australia Western · Perth" },
  { value: "Pacific/Auckland", label: "New Zealand · Auckland" },
  { value: "Africa/Johannesburg", label: "South Africa · Johannesburg" },
  { value: "Asia/Karachi", label: "Pakistan · Karachi" },
  { value: "Asia/Dhaka", label: "Bangladesh · Dhaka" },
  { value: "Asia/Kathmandu", label: "Nepal · Kathmandu" },
  { value: "Asia/Colombo", label: "Sri Lanka · Colombo" },
  { value: "Asia/Bangkok", label: "Thailand · Bangkok · ICT" },
] as const;

const POPULAR_LABELS = new Map<string, string>(TIMEZONE_OPTIONS.map((x) => [x.value, x.label]));

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function humanCity(value: string) {
  const parts = value.split("/");
  const city = parts.at(-1)?.replaceAll("_", " ") ?? value;
  const region = parts.length > 1 ? parts[0].replaceAll("_", " ") : "";
  return region ? `${city} · ${region}` : city;
}

export function isValidTimeZone(value?: string) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function supportedTimeZones() {
  const intlWithZones = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const discovered = typeof intlWithZones.supportedValuesOf === "function" ? intlWithZones.supportedValuesOf("timeZone") : [];
  const values = Array.from(new Set([...TIMEZONE_OPTIONS.map((x) => x.value), ...discovered]));
  const popular = new Set<string>(TIMEZONE_OPTIONS.map((x) => x.value));
  values.sort((a, b) => {
    const ap = popular.has(a), bp = popular.has(b);
    if (ap !== bp) return ap ? -1 : 1;
    if (ap && bp) return TIMEZONE_OPTIONS.findIndex((x) => x.value === a) - TIMEZONE_OPTIONS.findIndex((x) => x.value === b);
    return humanCity(a).localeCompare(humanCity(b));
  });
  return values;
}

export function timeZoneLabel(value?: string) {
  if (!value) return "India · Delhi / Mumbai · IST";
  return POPULAR_LABELS.get(value) ?? `${humanCity(value)} · ${value}`;
}

export function shortTimeZoneLabel(value?: string, date = new Date()) {
  if (!value || value === IST_TIMEZONE) return "IST";
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: value, timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    if (name && !name.startsWith("GMT")) return name;
  } catch {
    // Fall back to the friendly aliases below.
  }
  if (value === "Asia/Dubai") return "GST";
  if (value === "Asia/Riyadh") return "AST";
  if (value === "America/New_York") return "ET";
  if (value === "America/Los_Angeles") return "PT";
  if (value === "America/Chicago") return "CT";
  if (value === "America/Denver") return "MT";
  if (value === "America/Phoenix") return "MST";
  if (value === "America/Anchorage") return "AKT";
  if (value === "Pacific/Honolulu") return "HST";
  if (value === "America/Halifax") return "AT";
  if (value === "America/St_Johns") return "NT";
  if (value === "Europe/London") return "UK";
  if (value === "Asia/Singapore") return "SGT";
  return value.split("/").at(-1)?.replaceAll("_", " ") ?? value;
}

export function formatClock(time: string) {
  if (!time) return "—";
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, "0")} ${suffix}`;
}

export function formatWeeklySchedule(slots?: WeeklyScheduleSlot[], timeZone?: string) {
  if (!slots?.length) return "Schedule to be confirmed";
  const ordered = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  return `${ordered.map((slot) => `${dayNames[slot.dayOfWeek]} ${formatClock(slot.startTime)}–${formatClock(slot.endTime)}`).join(" · ")} · ${shortTimeZoneLabel(timeZone)}`;
}

function partsFor(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMs(date: Date, timeZone: string) {
  const p = partsFor(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

export function zonedLocalToUtc(date: string, time: string, timeZone = IST_TIMEZONE) {
  const zone = isValidTimeZone(timeZone) ? timeZone : IST_TIMEZONE;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute || 0, 0);
  const guess = new Date(localAsUtc);
  const firstOffset = offsetMs(guess, zone);
  let resolved = new Date(localAsUtc - firstOffset);
  const secondOffset = offsetMs(resolved, zone);
  if (secondOffset !== firstOffset) resolved = new Date(localAsUtc - secondOffset);
  return resolved;
}

export function formatInTimeZone(date: string, time: string, sourceTimeZone: string, targetTimeZone: string) {
  const instant = zonedLocalToUtc(date, time, sourceTimeZone || IST_TIMEZONE);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: isValidTimeZone(targetTimeZone) ? targetTimeZone : IST_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(instant);
}

export function istReference(date: string, time: string, sourceTimeZone: string) {
  return formatInTimeZone(date, time, sourceTimeZone || IST_TIMEZONE, IST_TIMEZONE);
}

export function browserTimeZone() {
  if (typeof Intl === "undefined") return IST_TIMEZONE;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || IST_TIMEZONE;
  return isValidTimeZone(zone) ? zone : IST_TIMEZONE;
}

export function zonedParts(date: string, time: string, sourceTimeZone: string, targetTimeZone: string) {
  const instant = zonedLocalToUtc(date, time, sourceTimeZone || IST_TIMEZONE);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimeZone(targetTimeZone) ? targetTimeZone : IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(formatter.formatToParts(instant).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, instant };
}

function clockMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function addIsoDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function crossesMidnight(startTime: string, endTime: string) {
  return clockMinutes(endTime) <= clockMinutes(startTime);
}

export function windowDurationMinutes(startTime: string, endTime: string) {
  const start = clockMinutes(startTime), end = clockMinutes(endTime);
  const raw = end - start;
  return raw > 0 ? raw : raw + 24 * 60;
}

export function zonedRangeParts(date: string, startTime: string, endTime: string, sourceTimeZone: string, targetTimeZone: string) {
  const start = zonedParts(date, startTime, sourceTimeZone, targetTimeZone);
  const sourceEndDate = crossesMidnight(startTime, endTime) ? addIsoDays(date, 1) : date;
  const end = zonedParts(sourceEndDate, endTime, sourceTimeZone, targetTimeZone);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    sourceEndDate,
    crossesMidnight: sourceEndDate !== date,
    startInstant: start.instant,
    endInstant: end.instant,
    durationMinutes: Math.max(0, Math.round((end.instant.getTime() - start.instant.getTime()) / 60000)),
  };
}

export function nextIsoDateForWeekday(startDate: string, dayOfWeek: number) {
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addIsoDays(startDate, offset);
    if (new Date(`${candidate}T12:00:00Z`).getUTCDay() === dayOfWeek) return candidate;
  }
  return startDate;
}

export function convertWeeklyScheduleSlots(
  slots: WeeklyScheduleSlot[],
  sourceTimeZone: string,
  targetTimeZone: string,
  referenceDate: string,
): WeeklyScheduleSlot[] {
  if (!slots.length) return [];
  if (sourceTimeZone === targetTimeZone) return slots.map((slot) => ({ ...slot }));
  return slots.map((slot) => {
    const sourceDate = nextIsoDateForWeekday(referenceDate, slot.dayOfWeek);
    const converted = zonedRangeParts(sourceDate, slot.startTime, slot.endTime, sourceTimeZone, targetTimeZone);
    return {
      dayOfWeek: new Date(`${converted.startDate}T12:00:00Z`).getUTCDay(),
      startTime: converted.startTime,
      endTime: converted.endTime,
    };
  });
}

export function weeklySlotConversion(
  slot: WeeklyScheduleSlot,
  sourceTimeZone: string,
  targetTimeZone: string,
  referenceDate: string,
) {
  const sourceDate = nextIsoDateForWeekday(referenceDate, slot.dayOfWeek);
  const converted = zonedRangeParts(sourceDate, slot.startTime, slot.endTime, sourceTimeZone, targetTimeZone);
  const startDay = dayNames[new Date(`${converted.startDate}T12:00:00Z`).getUTCDay()];
  const endDay = dayNames[new Date(`${converted.endDate}T12:00:00Z`).getUTCDay()];
  return {
    ...converted,
    startDay,
    endDay,
    label: converted.startDate === converted.endDate
      ? `${startDay} ${formatClock(converted.startTime)}–${formatClock(converted.endTime)}`
      : `${startDay} ${formatClock(converted.startTime)}–${endDay} ${formatClock(converted.endTime)}`,
  };
}
