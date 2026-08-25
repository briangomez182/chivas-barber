import { NextResponse } from 'next/server';

import { deleteBarber, updateBarber, type BarberInput } from '@/lib/db';
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

  const patch: Partial<BarberInput> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if (typeof body.role === 'string') patch.role = body.role.trim();
  if (typeof body.specialty === 'string') {
    patch.specialty = body.specialty.trim();
  }
  if (typeof body.photoUrl === 'string') {
    patch.photoUrl = body.photoUrl.trim();
  }
  if (typeof body.active === 'boolean') patch.active = body.active;

  const barber = await updateBarber(id, patch);

  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ barber });
}

/** DELETE /api/barbers/:id — baja definitiva y limpieza de turnos (admin). */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await deleteBarber(id);

  if (!removed) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
