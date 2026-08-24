import { NextResponse } from 'next/server';

import { updateDb } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import type { Barber } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type BarberPatch = Partial<Omit<Barber, 'id' | 'createdAt'>>;

/** PATCH /api/barbers/:id — edición (admin). */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as BarberPatch;

  const result = await updateDb((db) => {
    const barber = db.barbers.find((item) => item.id === id);
    if (!barber) return null;

    if (typeof body.name === 'string' && body.name.trim()) {
      barber.name = body.name.trim();
    }
    if (typeof body.role === 'string') barber.role = body.role.trim();
    if (typeof body.specialty === 'string') {
      barber.specialty = body.specialty.trim();
    }
    if (typeof body.photoUrl === 'string') {
      barber.photoUrl = body.photoUrl.trim();
    }
    if (typeof body.active === 'boolean') barber.active = body.active;

    return barber;
  });

  if (!result) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ barber: result });
}

/** DELETE /api/barbers/:id — baja definitiva y limpieza de turnos (admin). */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await updateDb((db) => {
    const index = db.barbers.findIndex((item) => item.id === id);
    if (index === -1) return false;

    db.barbers.splice(index, 1);
    db.appointments = db.appointments.filter((item) => item.barberId !== id);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
