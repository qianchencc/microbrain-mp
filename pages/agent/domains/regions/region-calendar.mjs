const DAY_MS = 86400000;

export const shiftDate = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export const validCalendarDate = (date) =>
  typeof date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

export function calendarDates(date, expanded) {
  const first = expanded ? `${date.slice(0, 7)}-01` : date;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = shiftDate(first, -weekday);
  if (!expanded) return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
  const month = date.slice(0, 7);
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)
  ).getUTCDate();
  const cells = Math.ceil((weekday + last) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => shiftDate(start, index));
}

export function calendarWindow(month) {
  const dates = calendarDates(`${month}-01`, true);
  return { from: dates[0], to: dates.at(-1) };
}
