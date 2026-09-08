import { NextResponse } from 'next/server';

import { nowMinutes, timeToMinutes, todayIso } from '@/lib/date';
import {
  bookAppointment,
  getBarber,
  getSettings,
  listAppointments,
  listScheduleBlocks,
  listServices,
} from '@/lib/db';
import { getSession } from '@/lib/guard';
import { buildSlots } from '@/lib/slots';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ============================================================================
// TEMPORAL — botón "Turno de prueba" del Turnero.
//
// Crea un turno de HOY para el barbero indicado, en el próximo horario libre,
// y lo marca como si hubiera pagado la seña (`status = 'confirmed'`, `amount`
// y `payment_status = 'approved'`) para probar el cartel de llegada sin pasar
// por Mercado Pago.
//
// Para quitarlo: borrar este archivo, el botón en `TurneroView.tsx` y
// `api.turnero.createTest` en `src/lib/api-client.ts`.
// ============================================================================

const TEST_NAMES = [
  'Bruno Prueba',
  'Carla Test',
  'Diego Demo',
  'Eva Ensayo',
  'Facu Ficticio',
];

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { barberId?: string };
  const barberId =
    session.role === 'editor' ? session.barberId : body.barberId;

  if (!barberId) {
    return NextResponse.json({ error: 'Falta barberId' }, { status: 400 });
  }

  const barber = await getBarber(barberId);
  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  const date = todayIso();
  const settings = await getSettings();
  const services = await listServices();
  const service = services[0] ?? null;
  const durationMin = service?.durationMin ?? settings.slotIntervalMin;

  const [appointments, blocks] = await Promise.all([
    listAppointments({ date, barberId }),
    listScheduleBlocks({ date, barberId }),
  ]);

  const slots = buildSlots({ date, durationMin, settings, appointments, blocks });
  const nowMin = nowMinutes();
  const freeSlot =
    slots.find((slot) => slot.available && timeToMinutes(slot.time) >= nowMin) ??
    slots.find((slot) => slot.available);

  if (!freeSlot) {
    return NextResponse.json(
      { error: 'No hay horarios libres hoy para el turno de prueba' },
      { status: 422 },
    );
  }

  const name = TEST_NAMES[Math.floor(Math.random() * TEST_NAMES.length)];
  const amount = settings.depositAmount > 0 ? settings.depositAmount : 3500;

  const result = await bookAppointment({
    barberId,
    serviceId: service?.id ?? null,
    date,
    time: freeSlot.time,
    durationMin,
    customerName: name,
    customerPhone: '5491100000000',
    customerEmail: null,
    notes: 'Turno de PRUEBA (botón temporal del Turnero)',
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  // Simula la seña aprobada por Mercado Pago.
  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .update({
      amount,
      payment_status: 'approved',
      payment_id: `TEST-${Date.now()}`,
    })
    .eq('id', result.appointment.id)
    .select('id, time, customer_name')
    .single<{ id: string; time: string; customer_name: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    appointment: {
      id: data.id,
      time: data.time,
      customerName: data.customer_name,
      amount,
    },
  });
}
