import { NextResponse } from 'next/server';

import {
  bookAppointmentPending,
  getBarber,
  getService,
  getSettings,
  setAppointmentStatus,
} from '@/lib/db';
import { createPreference } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';

interface CheckoutBody {
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
 * POST /api/checkout — arranca el flujo de pago de un turno (público, sin
 * sesión).
 *
 * 1. Crea el turno en `pending_payment` vía `bookAppointmentPending` (mismo
 *    advisory lock + chequeo de solapamiento atómico que el alta de staff).
 * 2. Genera una preferencia de Checkout Pro con `external_reference` = ID
 *    del turno.
 * 3. Devuelve `checkoutUrl` para redirigir al cliente a pagar.
 *
 * El turno recién queda `confirmed` cuando llega el webhook de pago
 * aprobado (`/api/mercado-pago/webhook`) — nunca antes. Reemplaza, para el
 * público, al viejo `POST /api/appointments` (que ahora es sólo para staff:
 * ver ese archivo).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as CheckoutBody;

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
  if (!service) {
    return NextResponse.json(
      { error: 'Elegí un servicio para poder cobrar el turno' },
      { status: 422 },
    );
  }

  // Se cobra la seña configurada por el admin (Configuraciones › Pagos), no
  // el precio del servicio — el resto se abona en el local.
  const settings = await getSettings();
  const amount = settings.depositAmount;

  if (!settings.depositEnabled || amount <= 0) {
    return NextResponse.json(
      { error: 'El cobro de seña está deshabilitado (sección Configuraciones del panel admin)' },
      { status: 422 },
    );
  }

  const durationMin = service.durationMin;
  const customerEmail = body.customerEmail?.trim() || null;

  const result = await bookAppointmentPending({
    barberId,
    serviceId: service.id,
    date,
    time,
    durationMin,
    customerName,
    customerPhone,
    customerEmail,
    notes: body.notes?.trim() || null,
    amount,
  });

  if ('error' in result) {
    return NextResponse.json(
      { error: 'Ese horario ya fue reservado. Elegí otro.' },
      { status: 409 },
    );
  }

  const { appointment } = result;

  try {
    const preference = await createPreference({
      appointmentId: appointment.id,
      title: `Seña — ${service.name} con ${barber.name} · Chivas Barbería Club`,
      unitPrice: amount,
      payerName: customerName,
      payerEmail: customerEmail,
    });

    return NextResponse.json(
      { appointment, checkoutUrl: preference.initPoint },
      { status: 201 },
    );
  } catch (cause) {
    await setAppointmentStatus(appointment.id, 'cancelled');
    console.error('[chivas] Error creando preferencia de Mercado Pago', cause);
    return NextResponse.json(
      { error: 'No pudimos iniciar el pago. Intentá nuevamente en unos minutos.' },
      { status: 502 },
    );
  }
}
