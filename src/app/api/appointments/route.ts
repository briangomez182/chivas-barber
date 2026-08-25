import { NextResponse } from 'next/server';

import {
  bookAppointment,
  getBarber,
  getService,
  getSettings,
  listAppointments,
} from '@/lib/db';
import { getSession } from '@/lib/guard';

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

  const appointments = await listAppointments(date ? { date } : {});

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

  const barber = await getBarber(barberId);
  if (!barber || !barber.active) {
    return NextResponse.json(
      { error: 'El barbero seleccionado no está disponible' },
      { status: 409 },
    );
  }

  const service = body.serviceId ? await getService(body.serviceId) : null;

  const durationMin = service
    ? service.durationMin
    : Number.isFinite(Number(body.durationMin)) && Number(body.durationMin) > 0
      ? Math.round(Number(body.durationMin))
      : (await getSettings()).slotIntervalMin;

  // El chequeo de solapamiento vive dentro de la transacción de Postgres
  // (ver `book_appointment` en supabase/schema.sql), no acá: si lo hiciéramos
  // en JS, dos reservas simultáneas podrían tomar el mismo horario.
  const result = await bookAppointment({
    barberId,
    serviceId: service?.id ?? null,
    date,
    time,
    durationMin,
    customerName,
    customerPhone,
    customerEmail: body.customerEmail?.trim() || null,
    notes: body.notes?.trim() || null,
  });

  if ('error' in result) {
    return NextResponse.json(
      { error: 'Ese horario ya fue reservado. Elegí otro.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ appointment: result.appointment }, { status: 201 });
}
