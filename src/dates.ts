const DAY = 86_400_000;
export const MIN_DATE = '2000-01-01';

export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function moscowToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)!.value).join('-');
}

export function shiftDays(value: string, days: number): string {
  const date = parseDate(value)!;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shiftMonths(value: string, months: number): string {
  const date = parseDate(value)!;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function dayCount(from: string, to: string): number {
  return Math.round((parseDate(to)!.getTime() - parseDate(from)!.getTime()) / DAY) + 1;
}

export function periodError(from: string, to: string, today = moscowToday()): string {
  if (!parseDate(from) || !parseDate(to)) return 'Введите обе даты в формате ДД.ММ.ГГГГ.';
  if (from < MIN_DATE || to < MIN_DATE) return 'Можно выбрать даты начиная с 01.01.2000.';
  if (from > today || to > today) return 'Будущие даты недоступны. Выберите дату не позже сегодня.';
  if (from > to) return 'Дата окончания должна быть не раньше даты начала.';
  if (dayCount(from, to) > 366) return 'Максимальный период — 366 дней. Сократите диапазон.';
  return '';
}

export const displayDate = (value: string): string => parseDate(value) ? value.split('-').reverse().join('.') : '';
export const inputDate = (value: string): string => /^\d{2}\.\d{2}\.\d{4}$/.test(value) ? value.split('.').reverse().join('-') : '';

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('.');
}
