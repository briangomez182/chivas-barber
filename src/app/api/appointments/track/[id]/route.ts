import { NextResponse } from 'next/server';

import { getAppointment, getBarber, getService } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/appointments/track/:id — seguimiento público y acotado de un
 * turno, para las páginas de retorno de Mercado Pago
 * (`/booking/success|pending|failure`).
 *
 * A propósito NO expone `customerPhone`/`customerEmail`/`notes`: cualquiera
 * con el link podría consultar este endpoint. `customerName` sí se expone
 * (se usa para personalizar el mensaje de WhatsApp de esta misma pantalla).
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  const appointment = await getAppointment(id);
  if (!appointment) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  const [barber, service] = await Promise.all([
    getBarber(appointment.barberId),
    appointment.serviceId ? getService(appointment.serviceId) : null,
  ]);

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      date: appointment.date,
      time: appointment.time,
      durationMin: appointment.durationMin,
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
      amount: appointment.amount,
      customerName: appointment.customerName,
      barberName: barber?.name ?? null,
      serviceName: service?.name ?? null,
    },
  });
}
