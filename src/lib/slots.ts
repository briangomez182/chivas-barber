import {
  minutesToTime,
  nowMinutes,
  timeToMinutes,
  todayIso,
  weekdayOf,
} from './date';
import type { Appointment, ScheduleBlock, Settings, Slot } from './types';

interface BuildSlotsInput {
  date: string;
  /** Duración del servicio elegido, en minutos. */
  durationMin: number;
  settings: Settings;
  /** Turnos ya reservados para ese barbero y fecha. */
  appointments: Appointment[];
  /** Tramos que el barbero (o el admin) marcó como no disponibles. */
  blocks?: ScheduleBlock[];
}

interface Busy {
  start: number;
  end: number;
}

/**
 * Minutos que un turno `pending_payment` bloquea el horario mientras el
 * cliente completa el pago en Mercado Pago. Pasado ese tiempo sin que llegue
 * la confirmación del webhook, se lo trata como si no existiera — evita que
 * un pago abandonado deje un slot "fantasma" bloqueado para siempre.
 * Tiene que coincidir con el intervalo usado en
 * supabase/migrations/0004_mercadopago_payments.sql.
 */
const PENDING_PAYMENT_TTL_MIN = 15;

/** ¿Este turno debe considerarse ocupado ahora mismo? */
function isBlocking(item: Appointment): boolean {
  if (item.status === 'cancelled') return false;
  if (item.status !== 'pending_payment') return true;

  const ageMin = (Date.now() - Date.parse(item.createdAt)) / 60_000;
  return ageMin < PENDING_PAYMENT_TTL_MIN;
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
  blocks = [],
}: BuildSlotsInput): Slot[] {
  const weekday = weekdayOf(date);
  if (!settings.workingDays.includes(weekday)) return [];

  const opening = timeToMinutes(settings.openingTime);
  const closing = timeToMinutes(settings.closingTime);
  const step = settings.slotIntervalMin;
  const buffer = settings.bufferMin;

  const busy: Busy[] = appointments
    .filter((item) => item.date === date && isBlocking(item))
    .map((item) => {
      const start = timeToMinutes(item.time);
      return { start, end: start + item.durationMin + buffer };
    });

  const dayBlocks = blocks.filter((item) => item.date === date);
  const allDayBlocked = dayBlocks.some((item) => item.startTime === null);
  const blockedRanges: Busy[] = dayBlocks
    .filter((item): item is ScheduleBlock & { startTime: string; endTime: string } =>
      item.startTime !== null && item.endTime !== null,
    )
    .map((item) => ({
      start: timeToMinutes(item.startTime),
      end: timeToMinutes(item.endTime),
    }));

  const isToday = date === todayIso();
  const currentMinutes = nowMinutes();
  const slots: Slot[] = [];

  for (let start = opening; start + durationMin <= closing; start += step) {
    const end = start + durationMin + buffer;
    const overlapsAppointment = busy.some((slot) => start < slot.end && end > slot.start);
    const overlapsBlock =
      allDayBlocked || blockedRanges.some((slot) => start < slot.end && end > slot.start);
    const isPast = isToday && start <= currentMinutes;

    slots.push({
      time: minutesToTime(start),
      endTime: minutesToTime(start + durationMin),
      available: !overlapsAppointment && !overlapsBlock && !isPast,
      reason: overlapsAppointment
        ? 'taken'
        : overlapsBlock
          ? 'blocked'
          : isPast
            ? 'past'
            : undefined,
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
    if (!isBlocking(item)) return false;

    const otherStart = timeToMinutes(item.time);
    const otherEnd = otherStart + item.durationMin + bufferMin;
    return start < otherEnd && end > otherStart;
  });
}
