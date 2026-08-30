import { NextResponse } from 'next/server';

import { bookAppointment, getBarber, getService, getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface BookBody {
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

/**
 * POST /api/book — reserva pública SIN cobro (público, sin sesión).
 *
 * Sólo funciona con `settings.depositEnabled === false`: si el admin apagó
 * el módulo de seña (Configuraciones › Pagos), el turno queda `confirmed` de
 * una — sin pasar por Mercado Pago — para que el cliente arregle el pago
 * completo directamente con el barbero (por WhatsApp o en el local).
 *
 * Con la seña habilitada este endpoint se rechaza a propósito: el flujo con
 * cobro es `POST /api/checkout`, así nadie puede saltarse el pago pegándole
 * directo a este endpoint.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const settings = await getSettings();
  if (settings.depositEnabled) {
    return NextResponse.json(
      { error: 'El pago de seña está habilitado: la reserva online requiere pago.' },
      { status: 422 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as BookBody;

  const barberId = body.barberId?.trim() ?? '';
  const date = body.date?.trim() ?? '';
  const time = body.time?.trim() ?? '';
  const customerName = body.customerName?.trim() ?? '';
  const customerPhone = body.customerPhone?.trim() ?? '';

  if (!barberId) {
    return NextResponse.json({ error: 'Elegí un barbero' }, { status: 400 });
  }
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return NextResponse.json({ error: 'Fecha u hora inválidas' }, { status: 400 });
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
      : settings.slotIntervalMin;

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
