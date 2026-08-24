import { NextResponse } from 'next/server';

import { updateDb } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
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

/** PATCH /api/appointments/:id — cambia el estado (admin). */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: AppointmentStatus;
  };

  if (!body.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const status = body.status;

  const appointment = await updateDb((db) => {
    const found = db.appointments.find((item) => item.id === id);
    if (!found) return null;
    found.status = status;
    return found;
  });

  if (!appointment) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ appointment });
}

/** DELETE /api/appointments/:id (admin) */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await updateDb((db) => {
    const index = db.appointments.findIndex((item) => item.id === id);
    if (index === -1) return false;
    db.appointments.splice(index, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
