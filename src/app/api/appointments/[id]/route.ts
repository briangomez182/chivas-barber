import { NextResponse } from 'next/server';

import {
  deleteAppointment,
  getAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
} from '@/lib/db';
import { requireAdmin, requireStaff } from '@/lib/guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AppointmentStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
  'done',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface PatchBody {
  status?: AppointmentStatus;
  barberId?: string;
  serviceId?: string | null;
  date?: string;
  time?: string;
  durationMin?: number;
}

/**
 * PATCH /api/appointments/:id — staff (admin o editor dueño del barbero).
 *
 * Sólo `status` → update simple (RLS lo acota para el editor). Cualquier
 * campo de `date`/`time`/`barberId`/`serviceId`/`durationMin` → reagendado
 * atómico vía RPC. Reasignar `barberId` a otro barbero es admin-only: la
 * policy/RPC ya lo bloquea para el editor, pero se valida antes también para
 * devolver un error claro.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const isReschedule =
    body.date !== undefined ||
    body.time !== undefined ||
    body.barberId !== undefined ||
    body.serviceId !== undefined ||
    body.durationMin !== undefined;

  if (!isReschedule) {
    if (!body.status || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const client =
      session.role === 'editor' ? await createServerSupabaseClient() : undefined;
    const appointment = await setAppointmentStatus(id, body.status, client);

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ appointment });
  }

  if (session.role === 'editor' && body.barberId && body.barberId !== session.barberId) {
    return NextResponse.json(
      { error: 'No podés reasignar turnos a otro barbero' },
      { status: 403 },
    );
  }

  if (body.date !== undefined && !DATE_PATTERN.test(body.date)) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }
  if (body.time !== undefined && !TIME_PATTERN.test(body.time)) {
    return NextResponse.json({ error: 'Hora inválida' }, { status: 400 });
  }

  const client =
    session.role === 'editor' ? await createServerSupabaseClient() : undefined;

  // Para reagendar hace falta el estado completo del turno: se completa con
  // lo que no vino en el body a partir de lo ya guardado.
  const existing = await getAppointment(id, client);
  if (!existing) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  const result = await rescheduleAppointment(
    id,
    {
      barberId: body.barberId ?? existing.barberId,
      serviceId: body.serviceId !== undefined ? body.serviceId : existing.serviceId,
      date: body.date ?? existing.date,
      time: body.time ?? existing.time,
      durationMin: body.durationMin ?? existing.durationMin,
    },
    client,
  );

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (result.error === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Ese horario ya fue reservado. Elegí otro.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ appointment: result.appointment });
}

/** DELETE /api/appointments/:id (admin) */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await deleteAppointment(id);

  if (!removed) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
