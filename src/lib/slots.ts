import {
  minutesToTime,
  nowMinutes,
  timeToMinutes,
  todayIso,
  weekdayOf,
} from './date';
import type { Appointment, Settings, Slot } from './types';

interface BuildSlotsInput {
  date: string;
  /** Duración del servicio elegido, en minutos. */
  durationMin: number;
  settings: Settings;
  /** Turnos ya reservados para ese barbero y fecha. */
  appointments: Appointment[];
}

interface Busy {
  start: number;
  end: number;
}

/**
 * Genera los bloques horarios de un día.
 *
 * - El paso entre bloques es `settings.slotIntervalMin` (15 / 30 / 45 / 60).
 * - Un bloque sólo existe si el servicio completo entra antes del cierre.
 * - Se descarta cualquier bloque que se superponga con un turno existente
 *   (incluyendo el `bufferMin` de descanso).
 * - En el día de hoy, los horarios ya pasados se marcan como no disponibles.
 */
export function buildSlots({
  date,
  durationMin,
  settings,
  appointments,
}: BuildSlotsInput): Slot[] {
  const weekday = weekdayOf(date);
  if (!settings.workingDays.includes(weekday)) return [];

  const opening = timeToMinutes(settings.openingTime);
  const closing = timeToMinutes(settings.closingTime);
  const step = settings.slotIntervalMin;
  const buffer = settings.bufferMin;

  const busy: Busy[] = appointments
    .filter((item) => item.date === date && item.status !== 'cancelled')
    .map((item) => {
      const start = timeToMinutes(item.time);
      return { start, end: start + item.durationMin + buffer };
    });

  const isToday = date === todayIso();
  const currentMinutes = nowMinutes();
  const slots: Slot[] = [];

  for (let start = opening; start + durationMin <= closing; start += step) {
    const end = start + durationMin + buffer;
    const overlaps = busy.some((slot) => start < slot.end && end > slot.start);
    const isPast = isToday && start <= currentMinutes;

    slots.push({
      time: minutesToTime(start),
      endTime: minutesToTime(start + durationMin),
      available: !overlaps && !isPast,
      reason: overlaps ? 'taken' : isPast ? 'past' : undefined,
    });
  }

  return slots;
}

/** ¿Un turno nuevo choca con alguno existente del mismo barbero? */
export function hasConflict(
  existing: Appointment[],
  candidate: Pick<Appointment, 'barberId' | 'date' | 'time' | 'durationMin'>,
  bufferMin: number,
): boolean {
  const start = timeToMinutes(candidate.time);
  const end = start + candidate.durationMin + bufferMin;

  return existing.some((item) => {
    if (item.barberId !== candidate.barberId) return false;
    if (item.date !== candidate.date) return false;
    if (item.status === 'cancelled') return false;

    const otherStart = timeToMinutes(item.time);
    const otherEnd = otherStart + item.durationMin + bufferMin;
    return start < otherEnd && end > otherStart;
  });
}
