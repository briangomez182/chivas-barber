import { NextResponse } from 'next/server';

import { createId, readDb, updateDb } from '@/lib/db';
import { getSession } from '@/lib/guard';
import { hasConflict } from '@/lib/slots';
import type { Appointment } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface AppointmentBody {
  barberId?: string;
  serviceId?: string | null;
  date?: string;
  time?: string;
  durationMin?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** GET /api/appointments — listado (sólo admin). `?date=` filtra por día. */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const db = await readDb();

  const appointments = db.appointments
    .filter((item) => (date ? item.date === date : true))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  return NextResponse.json({ appointments });
}

/** POST /api/appointments — reserva pública de un turno. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as AppointmentBody;

  const barberId = body.barberId?.trim() ?? '';
  const date = body.date?.trim() ?? '';
  const time = body.time?.trim() ?? '';
  const customerName = body.customerName?.trim() ?? '';
  const customerPhone = body.customerPhone?.trim() ?? '';

  if (!barberId) {
    return NextResponse.json({ error: 'Elegí un barbero' }, { status: 400 });
  }
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return NextResponse.json(
      { error: 'Fecha u hora inválidas' },
      { status: 400 },
    );
  }
  if (customerName.length < 2) {
    return NextResponse.json({ error: 'Ingresá tu nombre' }, { status: 400 });
  }
  if (customerPhone.replace(/\D/g, '').length < 8) {
    return NextResponse.json(
      { error: 'Ingresá un teléfono de contacto válido' },
      { status: 400 },
    );
  }

  const result = await updateDb((db) => {
    const barber = db.barbers.find((item) => item.id === barberId);
    if (!barber || !barber.active) {
      return { error: 'El barbero seleccionado no está disponible' } as const;
    }

    const service = body.serviceId
      ? db.services.find((item) => item.id === body.serviceId)
      : undefined;

    const durationMin = service
      ? service.durationMin
      : Number.isFinite(Number(body.durationMin)) && Number(body.durationMin) > 0
        ? Math.round(Number(body.durationMin))
        : db.settings.slotIntervalMin;

    const candidate = { barberId, date, time, durationMin };

    if (hasConflict(db.appointments, candidate, db.settings.bufferMin)) {
      return { error: 'Ese horario ya fue reservado. Elegí otro.' } as const;
    }

    const appointment: Appointment = {
      id: createId(),
      barberId,
      serviceId: service?.id ?? null,
      date,
      time,
      durationMin,
      customerName,
      customerPhone,
      customerEmail: body.customerEmail?.trim() || null,
      notes: body.notes?.trim() || null,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    db.appointments.push(appointment);
    return { appointment } as const;
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ appointment: result.appointment }, { status: 201 });
}
