/**
 * Utilidades de fecha/hora sin dependencias.
 *
 * Regla del proyecto: las fechas se manejan siempre como string `YYYY-MM-DD`
 * y las horas como `HH:mm`. Nunca se serializa un `Date` crudo, así el
 * servidor (UTC) y el navegador (America/Argentina/Buenos_Aires) coinciden.
 */

export const TIMEZONE = 'America/Argentina/Buenos_Aires';

export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WEEKDAY_LABELS_LONG = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
export const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Partes de fecha/hora "ahora" en el huso de la barbería. */
function shopParts(): { date: string; minutes: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';

  const hour = Number(pick('hour')) % 24;
  const minute = Number(pick('minute'));

  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    minutes: hour * 60 + minute,
  };
}

/** Hoy en formato `YYYY-MM-DD` según el huso de la barbería. */
export function todayIso(): string {
  return shopParts().date;
}

/** Minutos transcurridos desde la medianoche local de la barbería. */
export function nowMinutes(): number {
  return shopParts().minutes;
}

export function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** `YYYY-MM-DD` → `{ year, month (0-11), day }`. */
export function parseIsoDate(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month: month - 1, day };
}

/** Día de la semana (0 = domingo) de una fecha `YYYY-MM-DD`. */
export function weekdayOf(iso: string): number {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

export function addDays(iso: string, amount: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const next = new Date(Date.UTC(year, month, day + amount));
  return toIsoDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Celdas de un calendario mensual (semana arrancando en domingo). `null` = hueco. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const total = daysInMonth(year, month);
  const cells: (string | null)[] = [];

  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(toIsoDate(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** `2026-08-24` → `Lunes 24 de agosto`. */
export function formatLongDate(iso: string): string {
  const { year, month, day } = parseIsoDate(iso);
  const weekday = WEEKDAY_LABELS_LONG[weekdayOf(iso)];
  const monthName = MONTH_LABELS[month].toLowerCase();
  const suffix = year !== Number(todayIso().slice(0, 4)) ? ` de ${year}` : '';
  return `${weekday} ${day} de ${monthName}${suffix}`;
}

const MONTH_LABELS_SHORT = MONTH_LABELS.map((month) => month.slice(0, 3));

/** `2026-03-12` → `12-Mar`. Para columnas de tabla donde el mes largo no entra. */
export function formatShortDate(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${String(day).padStart(2, '0')}-${MONTH_LABELS_SHORT[month]}`;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** `45` → `45 min`; `90` → `1 h 30 min`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Precio en pesos argentinos, sin decimales. */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
