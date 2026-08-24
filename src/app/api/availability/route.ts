import { NextResponse } from 'next/server';

import { readDb } from '@/lib/db';
import { buildSlots } from '@/lib/slots';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/availability?barberId=…&date=YYYY-MM-DD&duration=45
 *
 * Devuelve los bloques del día ya cruzados con los turnos existentes.
 * Si no se envía `duration`, se usa el intervalo global de la agenda.
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

  const db = await readDb();

  if (barberId && !db.barbers.some((item) => item.id === barberId)) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  const durationMin = Number.isFinite(durationParam) && durationParam > 0
    ? Math.round(durationParam)
    : db.settings.slotIntervalMin;

  const appointments = db.appointments.filter(
    (item) => item.date === date && (!barberId || item.barberId === barberId),
  );

  const slots = buildSlots({
    date,
    durationMin,
    settings: db.settings,
    appointments,
  });

  return NextResponse.json({ date, barberId, durationMin, slots });
}
