import { NextResponse } from 'next/server';

import { lastBookableDate } from '@/lib/date';
import { getBarber, getSettings, listAppointments, listScheduleBlocks } from '@/lib/db';
import { buildSlots } from '@/lib/slots';
import { DEFAULT_BOOKING_WINDOW_DAYS } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/availability?barberId=…&date=YYYY-MM-DD&duration=45
 *
 * Devuelve los bloques del día ya cruzados con los turnos existentes. La
 * agenda (apertura/cierre, días, intervalo, descanso) es la del barbero; sin
 * `barberId` se usa la global por defecto. Si no se envía `duration`, se usa
 * el intervalo de esa agenda.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const barberId = searchParams.get('barberId');
  const date = searchParams.get('date');
  const durationParam = Number(searchParams.get('duration'));

  if (!date || !DATE_PATTERN.test(date)) {
    return NextResponse.json(
      { error: 'Parámetro `date` inválido (se espera YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  const barber = barberId ? await getBarber(barberId) : null;
  if (barberId && !barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  const schedule = barber ?? (await getSettings());

  const durationMin = Number.isFinite(durationParam) && durationParam > 0
    ? Math.round(durationParam)
    : schedule.slotIntervalMin;

  // Fuera de la ventana de días habilitados del barbero no hay nada para
  // reservar. El calendario público ya lo bloquea; esto cierra la puerta a
  // pedir la fecha directo por la API.
  const windowDays = barber?.bookingWindowDays ?? DEFAULT_BOOKING_WINDOW_DAYS;
  if (date > lastBookableDate(windowDays)) {
    return NextResponse.json({ date, barberId, durationMin, slots: [] });
  }

  const appointments = await listAppointments({
    date,
    ...(barberId ? { barberId } : {}),
  });
  const blocks = await listScheduleBlocks({
    date,
    ...(barberId ? { barberId } : {}),
  });

  const slots = buildSlots({
    date,
    durationMin,
    schedule,
    appointments,
    blocks,
  });

  return NextResponse.json({ date, barberId, durationMin, slots });
}
