import { NextResponse } from 'next/server';

import {
  bookAppointment,
  getBarber,
  getService,
  getSettings,
  listAppointmentsPage,
} from '@/lib/db';
import { getSession, requireStaff } from '@/lib/guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

/** Tope de turnos por página — ni admin ni editor pueden pedir más. */
const PAGE_SIZE = 20;

/**
 * GET /api/appointments — listado paginado (staff), 20 turnos por página.
 * `?date=` filtra por día. `?barberId=` filtra por barbero (lo usa el admin)
 * — un editor lo ignora: siempre ve sólo su propio barbero. `?page=` (1-based).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  if (session.role === 'editor') {
    const supabase = await createServerSupabaseClient();
    const { appointments, total } = await listAppointmentsPage(
      { ...(date ? { date } : {}), barberId: session.barberId ?? undefined },
      page,
      PAGE_SIZE,
      supabase,
    );
    return NextResponse.json({ appointments, total, page, pageSize: PAGE_SIZE });
  }

  const barberId = searchParams.get('barberId');
  const { appointments, total } = await listAppointmentsPage(
    {
      ...(date ? { date } : {}),
      ...(barberId ? { barberId } : {}),
    },
    page,
    PAGE_SIZE,
  );

  return NextResponse.json({ appointments, total, page, pageSize: PAGE_SIZE });
}

/**
 * POST /api/appointments — alta manual de un turno por staff (admin o
 * editor), ya `confirmed`, sin pasar por Mercado Pago.
 *
 * Antes esto también aceptaba reservas públicas anónimas — quedó cerrado a
 * staff porque ahora el turno público SIEMPRE se paga: el flujo con cobro es
 * `POST /api/checkout`, que crea el turno en `pending_payment` y sólo lo
 * confirma cuando llega el webhook de pago aprobado
 * (`/api/mercado-pago/webhook`). Dejar este endpoint abierto a cualquiera
 * permitiría confirmarse un turno gratis pegándole directo, sin pagar.
 *
 * Si quien reserva es editor, se fuerza `barberId` a su propio barbero (alta
 * manual "estrictamente en su propia agenda"), sin importar qué `barberId`
 * haya mandado el body.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as AppointmentBody;

  const isEditor = session.role === 'editor';
  const barberId = isEditor ? (session.barberId ?? '') : (body.barberId?.trim() ?? '');
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
  const result = await bookAppointment(
    {
      barberId,
      serviceId: service?.id ?? null,
      date,
      time,
      durationMin,
      customerName,
      customerPhone,
      customerEmail: body.customerEmail?.trim() || null,
      notes: body.notes?.trim() || null,
    },
    isEditor ? await createServerSupabaseClient() : undefined,
  );

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Ese horario ya fue reservado. Elegí otro.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ appointment: result.appointment }, { status: 201 });
}
