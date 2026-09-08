import { NextResponse } from 'next/server';

import { minutesToTime, nowMinutes, timeToMinutes, todayIso } from '@/lib/date';
import {
  getBarber,
  getSettings,
  listAppointments,
  listScheduleBlocks,
} from '@/lib/db';
import { getSession } from '@/lib/guard';
import { buildSlots } from '@/lib/slots';
import type { Appointment, ScheduleBlock, TurneroBlock, TurneroSnapshot } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Cuántos bloques hacia adelante muestra el turnero. */
const UPCOMING_BLOCKS = 3;

/**
 * GET /api/turnero?barberId=… — foto del día para la vista Turnero.
 *
 * - `editor`: siempre su propio barbero (se ignora `?barberId`).
 * - `admin`: `?barberId` es obligatorio (lo elige con el selector).
 *
 * Devuelve los próximos `UPCOMING_BLOCKS` bloques de la agenda (cada uno con
 * su turno o "Libre") más la lista de turnos de hoy, que el front usa para
 * detectar altas nuevas entre un poll y el siguiente.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const barberId =
    session.role === 'editor' ? session.barberId : searchParams.get('barberId');

  if (!barberId) {
    return NextResponse.json({ error: 'Elegí un barbero' }, { status: 400 });
  }

  const barber = await getBarber(barberId);
  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  const date = todayIso();
  const settings = await getSettings();

  const [appointments, blocks] = await Promise.all([
    listAppointments({ date, barberId }),
    listScheduleBlocks({ date, barberId }),
  ]);

  const step = settings.slotIntervalMin;
  const slots = buildSlots({
    date,
    durationMin: step,
    settings,
    appointments,
    blocks,
  });

  const currentMin = nowMinutes();

  // Bloques de hoy que todavía no terminaron (incluye el que está en curso).
  const upcoming = slots.filter(
    (slot) => timeToMinutes(slot.time) + step > currentMin,
  );

  const active = appointments
    .filter((appointment) => appointment.status !== 'cancelled')
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const appointmentAt = (startMin: number): Appointment | null =>
    active.find((appointment) => {
      const from = timeToMinutes(appointment.time);
      return from <= startMin && startMin < from + appointment.durationMin;
    }) ?? null;

  const blockReasonAt = (startMin: number): string | null => {
    for (const block of blocks as ScheduleBlock[]) {
      if (block.startTime === null) return block.reason || 'Bloqueado';
      if (block.endTime === null) continue;
      const from = timeToMinutes(block.startTime);
      const to = timeToMinutes(block.endTime);
      if (startMin < to && startMin + step > from) return block.reason || 'Bloqueado';
    }
    return null;
  };

  // Un turno que dura más que el intervalo pisa varios slots de la grilla.
  // Se emite UNA sola card por turno (en su primer slot, con su rango real) y
  // los slots siguientes que ese mismo turno ocupa se saltean.
  const turneroBlocks: TurneroBlock[] = [];
  const emitted = new Set<string>();

  for (const slot of upcoming) {
    if (turneroBlocks.length >= UPCOMING_BLOCKS) break;

    const startMin = timeToMinutes(slot.time);
    const appointment = appointmentAt(startMin);

    if (appointment) {
      if (emitted.has(appointment.id)) continue; // continuación del mismo turno
      emitted.add(appointment.id);
      const from = timeToMinutes(appointment.time);
      turneroBlocks.push({
        time: appointment.time,
        endTime: minutesToTime(from + appointment.durationMin),
        state: 'booked',
        appointment,
        blockedReason: null,
      });
      continue;
    }

    const reason = slot.reason === 'blocked' ? blockReasonAt(startMin) : null;
    turneroBlocks.push({
      time: slot.time,
      endTime: minutesToTime(startMin + step),
      state: reason ? 'blocked' : 'free',
      appointment: null,
      blockedReason: reason,
    });
  }

  // Relleno hasta 3 bloques: la jornada ya no tiene más horarios.
  while (turneroBlocks.length < UPCOMING_BLOCKS) {
    turneroBlocks.push({
      time: null,
      endTime: null,
      state: 'free',
      appointment: null,
      blockedReason: null,
    });
  }

  const snapshot: TurneroSnapshot = {
    date,
    barberId,
    barberName: barber.name,
    blocks: turneroBlocks,
    today: active,
  };

  return NextResponse.json(snapshot);
}
