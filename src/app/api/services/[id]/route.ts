import { NextResponse } from 'next/server';

import { deleteService, updateService, type ServiceInput } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import type { Service } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ServicePatch = Partial<Omit<Service, 'id' | 'createdAt'>>;

/** PATCH /api/services/:id (admin) */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ServicePatch;

  const patch: Partial<ServiceInput> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if (typeof body.description === 'string') {
    patch.description = body.description.trim();
  }
  if (Number.isFinite(Number(body.durationMin))) {
    patch.durationMin = Math.round(Number(body.durationMin));
  }
  if (Number.isFinite(Number(body.price))) {
    patch.price = Math.round(Number(body.price));
  }
  if (typeof body.featured === 'boolean') patch.featured = body.featured;

  const service = await updateService(id, patch);

  if (!service) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ service });
}

/** DELETE /api/services/:id (admin) */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await deleteService(id);

  if (!removed) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
